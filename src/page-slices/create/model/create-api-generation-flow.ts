import { ChatInputError } from "@/entities/chat";
import { MeshyTaskConflictError, ModelGenerationInputError } from "@/features/generate-3d-model";
import type {
  generateImageTo3D,
  generateTextTo3D,
  getMeshyTaskStatus,
  MeshyTaskStatus,
} from "@/features/generate-3d-model";
import type { sendChatMessage, SentChatMessage } from "@/features/send-chat-message";
import { ApiError } from "@/shared/api";
import { createRequestStorage, type CreateRequestKind, type SavedCreateRequest } from "./create-api-request-storage";

export interface CreateApiTransport {
  sendChatMessage: typeof sendChatMessage;
  generateTextTo3D: typeof generateTextTo3D;
  generateImageTo3D: typeof generateImageTo3D;
  getMeshyTaskStatus: typeof getMeshyTaskStatus;
}

/** Read live, verified auth state. Recovery must attest reauthentication, including after navigation. */
export type GetVerifiedCreateAccountScope = (purpose: "request" | "reauthentication") => string | null;

export type CreateApiAction =
  | { kind: "chat"; message: string; image?: File }
  | { kind: "text"; prompt: string }
  | { kind: "image"; image: File };

type ObservationStop = "paused" | "registration-pending" | "not-found" | "access-denied" |
  "lookup-failed" | "reauth-required";
type AcceptedRequest = Exclude<SavedCreateRequest, { status: "uncertain" }>;

export type CreateApiState =
  | { phase: "idle" | "restoring" | "storage-unavailable" | "uncertain" }
  | { phase: "submitting"; kind: CreateRequestKind }
  | { phase: "pending" | "waiting-to-resume"; taskId: string }
  | { phase: "succeeded"; result: SentChatMessage | Extract<MeshyTaskStatus, { status: "SUCCEEDED" }> }
  | { phase: "failed"; taskId: string; failureReason?: string }
  | { phase: "observing-stopped"; taskId: string; reason: ObservationStop }
  | { phase: "rejected"; message: string };

interface Operation {
  controller: AbortController;
  timer: ReturnType<typeof setTimeout> | null;
  unsubscribe: (() => void) | null;
}

interface Lookup {
  waiters: Set<() => void> | null;
  settledAt: number;
}

const STATUS_INTERVAL_MS = 5000;
// Survives route component remounts. Cancelling a flow does not release an in-flight GET.
const lookups = new Map<string, Lookup>();

export function canSubmitCreateApiAction(state: CreateApiState) {
  return state.phase === "idle" || state.phase === "succeeded" ||
    state.phase === "failed" || state.phase === "rejected";
}

export function canRecheckCreateApiTask(state: CreateApiState) {
  return state.phase === "observing-stopped" &&
    state.reason !== "not-found" && state.reason !== "access-denied";
}

function needsReauthentication(status: AcceptedRequest["status"]) {
  return status === "reauth-required" || status === "reauth-required-conflict";
}

function isFirstConflictLookup(status: AcceptedRequest["status"]) {
  return status === "conflict" || status === "reauth-required-conflict";
}

function canObserve(request: SavedCreateRequest | null): request is AcceptedRequest {
  return request !== null && request.status !== "uncertain" &&
    request.status !== "not-found" && request.status !== "forbidden" && request.status !== "access-denied";
}

function lookupStopReason(error: unknown, firstConflictLookup: boolean): ObservationStop {
  if (!(error instanceof ApiError)) return "lookup-failed";
  if (error.status === 404) return firstConflictLookup ? "registration-pending" : "not-found";
  if (error.status === 403) return "access-denied";
  return "lookup-failed";
}

function restoredState(request: SavedCreateRequest | null): CreateApiState {
  if (!request) return { phase: "idle" };
  if (request.status === "uncertain") return { phase: "uncertain" };
  let reason: ObservationStop = "paused";
  if (needsReauthentication(request.status)) reason = "reauth-required";
  else if (request.status === "not-found") reason = "not-found";
  else if (request.status === "forbidden" || request.status === "access-denied") reason = "access-denied";
  return { phase: "observing-stopped", taskId: request.taskId, reason };
}

export function createApiGenerationFlow(
  transport?: CreateApiTransport,
  requestScope?: string,
) {
  let getVerifiedAccountScope: GetVerifiedCreateAccountScope | undefined;
  let state: CreateApiState = { phase: transport ? "restoring" : "idle" };
  let active: Operation | null = null;
  const listeners = new Set<() => void>();
  const storage = createRequestStorage(requestScope);

  function publish(next: CreateApiState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function begin(): Operation {
    const operation = { controller: new AbortController(), timer: null, unsubscribe: null };
    active = operation;
    return operation;
  }

  function cancel() {
    const operation = active;
    active = null;
    if (!operation) return;
    if (operation.timer !== null) clearTimeout(operation.timer);
    operation.unsubscribe?.();
    operation.controller.abort();
  }

  function storageUnavailable() {
    cancel();
    publish({ phase: "storage-unavailable" });
  }

  function restore() {
    if (!transport || active) return;
    try {
      publish(restoredState(storage.read()));
    } catch {
      storageUnavailable();
    }
  }

  function complete(operation: Operation, next: CreateApiState) {
    if (active !== operation) return;
    active = null;
    publish(next);
  }

  function persist(expectedId: string | null, next: SavedCreateRequest | null) {
    try {
      storage.replace(expectedId, next);
      return true;
    } catch {
      storageUnavailable();
      return false;
    }
  }

  function hasVerifiedAccount(reauthenticate = false) {
    try {
      return !!requestScope && getVerifiedAccountScope?.("request") === requestScope &&
        (!reauthenticate || getVerifiedAccountScope("reauthentication") === requestScope);
    } catch {
      return false;
    }
  }

  function pauseForReauthentication(operation: Operation, request: AcceptedRequest) {
    const status = isFirstConflictLookup(request.status) ? "reauth-required-conflict" : "reauth-required";
    if (request.status !== status && !persist(request.id, { ...request, status })) return;
    complete(operation, { phase: "observing-stopped", taskId: request.taskId, reason: "reauth-required" });
  }

  function lookupKey(taskId: string) {
    return requestScope + ":" + taskId;
  }

  function schedule(operation: Operation, request: AcceptedRequest) {
    if (active !== operation) return;
    const taskId = request.taskId;
    const key = lookupKey(taskId);
    const waiters = lookups.get(key)?.waiters;
    if (waiters) {
      const resume = () => {
        operation.unsubscribe = null;
        schedule(operation, request);
      };
      waiters.add(resume);
      operation.unsubscribe = () => { waiters.delete(resume); };
      publish({ phase: "waiting-to-resume", taskId });
      return;
    }

    publish({ phase: "pending", taskId });
    if (active !== operation) return;
    operation.timer = setTimeout(() => {
      operation.timer = null;
      void observe(operation, request);
    }, STATUS_INTERVAL_MS);
  }

  async function readStatus(api: CreateApiTransport, operation: Operation, taskId: string, lookup: Lookup) {
    try {
      return await api.getMeshyTaskStatus(taskId, { signal: operation.controller.signal });
    } finally {
      const waiters = lookup.waiters;
      lookup.settledAt = performance.now();
      lookup.waiters = null;
      waiters?.forEach((resume) => resume());
    }
  }

  async function observe(operation: Operation, request: AcceptedRequest) {
    if (!transport || active !== operation) return;
    const taskId = request.taskId;
    const key = lookupKey(taskId);
    const lookup = lookups.get(key) ?? { settledAt: -Infinity, waiters: null };
    if (lookup.waiters || performance.now() - lookup.settledAt < STATUS_INTERVAL_MS) {
      schedule(operation, request);
      return;
    }

    // Another instance in this tab may have completed or changed the saved request.
    try {
      const current = storage.read();
      if (!canObserve(current) || current.id !== request.id || current.taskId !== taskId) {
        complete(operation, restoredState(current));
        return;
      }
      request = current;
    } catch {
      storageUnavailable();
      return;
    }

    if (!hasVerifiedAccount(needsReauthentication(request.status))) {
      pauseForReauthentication(operation, request);
      return;
    }

    lookup.waiters = new Set();
    lookups.set(key, lookup);
    let result: MeshyTaskStatus;
    try {
      result = await readStatus(transport, operation, taskId, lookup);
    } catch (error) {
      if (active !== operation) return;
      if (error instanceof ApiError && error.status === 401) {
        pauseForReauthentication(operation, request);
        return;
      }
      const reason = lookupStopReason(error, isFirstConflictLookup(request.status));
      const status = reason === "access-denied" ? "forbidden" : reason === "not-found" ? reason : "accepted";
      if (status !== request.status && !persist(request.id, { ...request, status })) return;
      complete(operation, { phase: "observing-stopped", taskId, reason });
      return;
    }

    if (active !== operation) return;
    if (result.status === "PENDING") {
      const next: AcceptedRequest = { ...request, status: "accepted" };
      if (request.status !== "accepted" && !persist(request.id, next)) return;
      schedule(operation, next);
      return;
    }

    // An authoritative terminal task response releases the saved request.
    if (!persist(request.id, null)) return;
    lookups.delete(key);
    complete(operation, result.status === "SUCCEEDED"
      ? { phase: "succeeded", result }
      : { phase: "failed", taskId, failureReason: result.failureReason });
  }

  function accept(operation: Operation, request: SavedCreateRequest, taskId: string, status: "accepted" | "conflict") {
    if (active !== operation) return;
    const next = { ...request, status, taskId };
    if (persist(request.id, next)) schedule(operation, next);
  }

  async function send(operation: Operation, request: SavedCreateRequest, action: CreateApiAction, api: CreateApiTransport) {
    const options = { signal: operation.controller.signal };
    try {
      if (action.kind === "chat") {
        const result = await api.sendChatMessage({ message: action.message, image: action.image }, options);
        if (active === operation && persist(request.id, null)) complete(operation, { phase: "succeeded", result });
        return;
      }
      const accepted = action.kind === "text"
        ? await api.generateTextTo3D({ prompt: action.prompt }, options)
        : await api.generateImageTo3D({ image: action.image }, options);
      accept(operation, request, accepted.taskId, "accepted");
    } catch (error) {
      if (active !== operation) return;
      if (action.kind !== "chat" && error instanceof MeshyTaskConflictError && error.taskId !== null) {
        accept(operation, request, error.taskId, "conflict");
        return;
      }
      // These errors are raised inside the client before it sends anything.
      if (error instanceof ChatInputError || error instanceof ModelGenerationInputError) {
        if (persist(request.id, null)) complete(operation, { phase: "rejected", message: error.message });
        return;
      }
      complete(operation, { phase: "uncertain" });
    }
  }

  function stop() {
    const previous = state;
    if (previous.phase === "submitting") {
      cancel();
      publish({ phase: "uncertain" });
    } else if (previous.phase === "pending" || previous.phase === "waiting-to-resume") {
      cancel();
      restore();
    }
  }

  return {
    setAccountVerifier(verifier?: GetVerifiedCreateAccountScope) {
      getVerifiedAccountScope = verifier;
    },
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    restore,
    submit(action: CreateApiAction) {
      if (!transport || active || !canSubmitCreateApiAction(state) || !hasVerifiedAccount()) return false;
      let request: SavedCreateRequest;
      try {
        const previous = storage.read();
        if (previous) {
          publish(restoredState(previous));
          return false;
        }
        request = { version: 1, id: crypto.randomUUID(), kind: action.kind, startedAt: Date.now(), status: "uncertain" };
      } catch {
        storageUnavailable();
        return false;
      }

      const operation = begin();
      if (!persist(null, request)) return false;
      publish({ phase: "submitting", kind: action.kind });
      if (active === operation) void send(operation, request, action, transport);
      return true;
    },
    stop,
    recheck() {
      if (!transport || active || !canRecheckCreateApiTask(state)) return false;
      try {
        const request = storage.read();
        if (!canObserve(request) || !hasVerifiedAccount(needsReauthentication(request.status))) {
          publish(restoredState(request));
          return false;
        }
        schedule(begin(), request);
        return true;
      } catch {
        storageUnavailable();
        return false;
      }
    },
    reset() {
      stop();
      restore();
    },
  };
}
