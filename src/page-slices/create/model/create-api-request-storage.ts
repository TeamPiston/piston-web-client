export type CreateRequestKind = "chat" | "text" | "image";
export type CreateRequestChannel = "chat" | "meshy";

export function requestChannel(kind: CreateRequestKind): CreateRequestChannel {
  return kind === "chat" ? "chat" : "meshy";
}

type SavedTaskStatus = "accepted" | "conflict" | "not-found" | "forbidden" | "access-denied" |
  "reauth-required" | "reauth-required-conflict";

interface RequestIdentity {
  version: 1;
  id: string;
  kind: CreateRequestKind;
  startedAt: number;
}

export type SavedCreateRequest = RequestIdentity & (
  | { status: "uncertain" }
  | { status: SavedTaskStatus; taskId: string; authSessionId?: string }
);

const REQUEST_KEY = "piston:create-api:pending:v1:";

function isSavedCreateRequest(value: unknown): value is SavedCreateRequest {
  if (typeof value !== "object" || value === null) return false;
  if (
    !("version" in value) || value.version !== 1 ||
    !("id" in value) || typeof value.id !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(value.id) ||
    !("kind" in value) || (value.kind !== "chat" && value.kind !== "text" && value.kind !== "image") ||
    !("startedAt" in value) || typeof value.startedAt !== "number" || !Number.isSafeInteger(value.startedAt) ||
    value.startedAt < 0 || !("status" in value)
  ) return false;

  if (value.status === "uncertain") return Object.keys(value).length === 5;
  const hasAuthSession = "authSessionId" in value;
  if (hasAuthSession && (
    (value.status !== "reauth-required" && value.status !== "reauth-required-conflict") ||
    typeof value.authSessionId !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(value.authSessionId)
  )) return false;

  return Object.keys(value).length === (hasAuthSession ? 7 : 6) && value.kind !== "chat" &&
    (value.status === "accepted" || value.status === "conflict" ||
      value.status === "not-found" || value.status === "forbidden" || value.status === "access-denied" ||
      value.status === "reauth-required" || value.status === "reauth-required-conflict") &&
    "taskId" in value && typeof value.taskId === "string" &&
    value.taskId.trim() !== "" && value.taskId !== "." && value.taskId !== ".." &&
    !/[\uD800-\uDFFF]/u.test(value.taskId);
}

/** The caller supplies a stable opaque authentication namespace, never a token or profile field. */
export function createRequestStorage(requestScope?: string, channel?: CreateRequestChannel) {
  const key = requestScope && /^[a-zA-Z0-9_-]{1,128}$/.test(requestScope)
    ? REQUEST_KEY + requestScope
    : null;

  function requireKey() {
    if (!key || typeof window === "undefined") throw new Error("Create request storage unavailable");
    return key;
  }

  function readKey(storageKey: string): SavedCreateRequest | null {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (!isSavedCreateRequest(value)) throw new Error("Invalid saved Create request");
    return value;
  }

  function readEntry() {
    const legacyKey = requireKey();
    const legacy = readKey(legacyKey);
    if (!channel) return { storageKey: legacyKey, request: legacy };

    const storageKey = legacyKey + ":" + channel;
    const request = readKey(storageKey);
    const legacyRequest = legacy && requestChannel(legacy.kind) === channel ? legacy : null;
    if ((request && requestChannel(request.kind) !== channel) || (request && legacyRequest)) {
      throw new Error("Conflicting saved Create requests");
    }
    return legacyRequest ? { storageKey: legacyKey, request: legacyRequest } : { storageKey, request };
  }

  function replace(expectedId: string | null, next: SavedCreateRequest | null) {
    const { storageKey, request } = readEntry();
    if ((request?.id ?? null) !== expectedId) throw new Error("Create request ownership changed");
    if (next && (!isSavedCreateRequest(next) || (channel && requestChannel(next.kind) !== channel))) {
      throw new Error("Invalid Create request to save");
    }
    if (next) window.sessionStorage.setItem(storageKey, JSON.stringify(next));
    else window.sessionStorage.removeItem(storageKey);
  }

  return { read: () => readEntry().request, replace };
}
