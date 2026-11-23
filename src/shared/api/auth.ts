export const SESSION_STORAGE_KEY = "piston-auth";
export const ACCESS_TOKEN_STORAGE_KEY = "piston-access-token";
export const API_SESSION_STORAGE_KEY = "piston-api-session";
export const AUTH_EXPIRED_EVENT = "piston-auth-expired";

const BLOCKED_AUTH_KEY = "piston-auth-cleanup-failed";
const AUTH_LOCK = "piston-auth-storage";
const AUTH_LOCK_CHECK_TIMEOUT_MS = 5_000;

export interface ApiTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiSession extends ApiTokens {
  id: string;
}

let revision = 0;
let blockedInThisTab: boolean | undefined;
let lockAccess: "unchecked" | "granted" | "denied" = "unchecked";
let pendingLockCheck: Promise<boolean> | undefined;

export class AuthExpiredEvent extends Event {
  constructor(
    readonly revision: number,
    readonly sessionId: string | null,
    readonly explicit: boolean,
  ) {
    super(AUTH_EXPIRED_EVENT);
  }
}

export function isToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !/\s/.test(value);
}

export function isStoredAuthBlocked() {
  if (blockedInThisTab !== undefined) return blockedInThisTab;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage?.getItem(BLOCKED_AUTH_KEY) === "true";
  } catch {
    return true;
  }
}

function getAuthLocks() {
  if (typeof window === "undefined" || lockAccess === "denied") return undefined;
  try {
    return window.navigator?.locks;
  } catch {
    return undefined;
  }
}

function parseApiSession(raw: string): ApiSession | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" ||
      !("id" in value) || !isToken(value.id) ||
      !("accessToken" in value) || !isToken(value.accessToken) ||
      !("refreshToken" in value) || !isToken(value.refreshToken)) return null;
    return { id: value.id, accessToken: value.accessToken, refreshToken: value.refreshToken };
  } catch {
    return null;
  }
}

type StoredAuth =
  | { status: "unavailable"; legacy?: string | null }
  | {
    status: "readable";
    record: string | null;
    legacy?: string | null;
    session: ApiSession | null;
    accessToken: string | null;
  };

function readAuthKey(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

function readStoredAuth(includeLegacy = false): StoredAuth {
  const record = readAuthKey(API_SESSION_STORAGE_KEY);
  const legacy = includeLegacy || record === null ? readAuthKey(ACCESS_TOKEN_STORAGE_KEY) : undefined;
  if (record === undefined || (record === null && legacy === undefined)) {
    return { status: "unavailable", legacy };
  }

  const session = record === null ? null : parseApiSession(record);
  const token = record === null ? legacy : session?.accessToken;
  return { status: "readable", record, legacy, session, accessToken: isToken(token) ? token : null };
}

export interface AuthSnapshot {
  storage: StoredAuth;
  revision: number;
  session: ApiSession | null;
  accessToken: string | null;
}

function snapshotOf(storage: StoredAuth): AuthSnapshot {
  return {
    storage, revision,
    session: storage.status === "readable" ? storage.session : null,
    accessToken: storage.status === "readable" ? storage.accessToken : null,
  };
}

export function captureAuth(includeLegacy = false): AuthSnapshot {
  return snapshotOf(getAuthLocks() && !isStoredAuthBlocked()
    ? readStoredAuth(includeLegacy)
    : { status: "unavailable" });
}

export function readApiSession() {
  return captureAuth().session;
}

function matchesAuth(expected: StoredAuth, current: StoredAuth, requireSameAccessToken = false) {
  if (expected.status !== "readable" || current.status !== "readable") return false;
  if (!expected.session) {
    return current.record === expected.record && current.accessToken === expected.accessToken;
  }
  return current.session?.id === expected.session.id &&
    (!requireSameAccessToken || current.accessToken === expected.accessToken);
}

export function noteAuthStorageChange() {
  revision++;
}

export function isCurrentAuthRevision(snapshot: AuthSnapshot) {
  return snapshot.revision === revision;
}

export function isCurrentAuth(snapshot: AuthSnapshot, current = captureAuth()) {
  return snapshot.revision === current.revision && matchesAuth(snapshot.storage, current.storage);
}

export function isCurrentAuthExpiry(event: AuthExpiredEvent, requireReadable = false) {
  if (event.revision !== revision) return false;
  if (event.explicit) return true;
  const stored = readStoredAuth();
  if (stored.status === "unavailable") return !requireReadable;
  return !stored.session || stored.session.id === event.sessionId;
}

export function beginApiLogin() {
  revision++;
  if (!getAuthLocks()) throw new Error("이 브라우저에서는 안전하게 로그인 세션을 저장할 수 없습니다.");
  // Explicit login can replace a signed-out session, but still respects the shared owner.
  const storage = readStoredAuth();
  if (storage.status === "unavailable") throw new Error("로그인 저장소에 접근할 수 없습니다.");
  return snapshotOf(storage);
}

function removeBlockedMarker() {
  try {
    window.sessionStorage?.removeItem(BLOCKED_AUTH_KEY);
  } catch {
    // A persisted marker still applies to future page loads.
  }
}

export function allowStoredAuthAfterLogin() {
  revision++;
  removeBlockedMarker();
  blockedInThisTab = false;
}

function fenceThisTab() {
  revision++;
  blockedInThisTab = true;
  try {
    window.sessionStorage?.setItem(BLOCKED_AUTH_KEY, "true");
  } catch {
    // In-memory fencing still applies while this document is alive.
  }
  return revision;
}

function notifyAuthExpiry(snapshot: AuthSnapshot, fencedRevision: number, explicit = false, redirect = false) {
  const event = new AuthExpiredEvent(fencedRevision, snapshot.session?.id ?? null, explicit);
  if (!isCurrentAuthExpiry(event)) return;
  window.dispatchEvent(event);
  if (redirect && isCurrentAuthExpiry(event, true) && window.location.pathname !== "/login") {
    window.location.assign(window.location.origin + "/login");
  }
}

export function blockUnverifiedAuth(snapshot: AuthSnapshot) {
  if (typeof window === "undefined" || !isCurrentAuthRevision(snapshot)) return;
  notifyAuthExpiry(snapshot, fenceThisTab());
}

function denyAuthLock(snapshot: AuthSnapshot) {
  if (lockAccess === "denied") return;
  const sameRevision = isCurrentAuthRevision(snapshot);
  if (!sameRevision && lockAccess === "granted") return;
  const current = sameRevision ? snapshot : captureAuth();
  lockAccess = "denied";
  blockUnverifiedAuth(current);
}

async function withAuthLock<T>(snapshot: AuthSnapshot, update: () => T, signal?: AbortSignal): Promise<T> {
  const locks = getAuthLocks();
  if (!locks) throw new Error("로그인 저장소를 동기화할 수 없습니다.");
  let acquired = false;
  try {
    return await locks.request(AUTH_LOCK, { mode: "exclusive", signal }, () => {
      acquired = true;
      if (lockAccess === "denied") throw new Error("로그인 저장소를 동기화할 수 없습니다.");
      lockAccess = "granted";
      return update();
    });
  } catch (error) {
    if (!acquired && !signal?.aborted) denyAuthLock(snapshot);
    throw error;
  }
}

export function hasConfirmedAuthLock() {
  return lockAccess === "granted" && !!getAuthLocks();
}

export async function ensureAuthLockAccess() {
  if (!getAuthLocks()) return false;
  if (hasConfirmedAuthLock()) return true;
  if (!pendingLockCheck) {
    const snapshot = captureAuth();
    pendingLockCheck = withAuthLock(snapshot, () => true, AbortSignal.timeout(AUTH_LOCK_CHECK_TIMEOUT_MS))
      .catch(() => {
        denyAuthLock(snapshot);
        return false;
      }).finally(() => { pendingLockCheck = undefined; });
  }
  return pendingLockCheck;
}

export async function saveApiSession(snapshot: AuthSnapshot, tokens: ApiTokens, signal?: AbortSignal) {
  return withAuthLock(snapshot, () => {
    signal?.throwIfAborted();
    if (!isCurrentAuthRevision(snapshot)) return null;
    const current = readStoredAuth();
    if (current.status === "unavailable") throw new Error("로그인 저장소에 접근할 수 없습니다.");
    if (!matchesAuth(snapshot.storage, current)) return null;

    const id = crypto.randomUUID();
    window.localStorage.setItem(API_SESSION_STORAGE_KEY, JSON.stringify({ ...tokens, id }));
    allowStoredAuthAfterLogin();
    return id;
  }, signal);
}

export async function updateApiAccessToken(snapshot: AuthSnapshot, accessToken: string) {
  return withAuthLock(snapshot, () => {
    if (!snapshot.session || !isCurrentAuthRevision(snapshot) || isStoredAuthBlocked()) return false;
    const current = readStoredAuth();
    if (current.status === "unavailable") throw new Error("로그인 저장소에 접근할 수 없습니다.");
    if (!matchesAuth(snapshot.storage, current)) return false;
    if (current.accessToken !== snapshot.accessToken) return true;
    window.localStorage.setItem(API_SESSION_STORAGE_KEY, JSON.stringify({ ...snapshot.session, accessToken }));
    return true;
  });
}

interface ClearAuthOptions {
  redirect?: boolean;
  requireSameAccessToken?: boolean;
  explicit?: boolean;
  mock?: boolean;
}

function removeAuthKeys(keys: string[]) {
  let removed = true;
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      removed = false;
    }
  }
  return removed;
}

export async function clearStoredAuth(
  expected: AuthSnapshot,
  { redirect = false, requireSameAccessToken = false, explicit = false, mock = false }: ClearAuthOptions = {},
) {
  if (typeof window === "undefined" || !isCurrentAuthRevision(expected)) return false;

  let fencedRevision: number | undefined;
  if (explicit) {
    fencedRevision = fenceThisTab();
    notifyAuthExpiry(expected, fencedRevision, true, redirect);
  }
  const operationRevision = revision;
  const clearUnderLock = () => {
    if (revision !== operationRevision) return;
    const current = readStoredAuth(explicit);
    if (matchesAuth(expected.storage, current, requireSameAccessToken)) {
      fencedRevision ??= fenceThisTab();
      if (removeAuthKeys([API_SESSION_STORAGE_KEY, ACCESS_TOKEN_STORAGE_KEY, SESSION_STORAGE_KEY])) {
        removeBlockedMarker();
        blockedInThisTab = undefined;
      }
    } else if (current.status === "unavailable" || expected.storage.status === "unavailable") {
      fencedRevision ??= fenceThisTab();
      // An unreadable session record must be preserved. A matching legacy value is independent.
      if (explicit && typeof expected.storage.legacy === "string" &&
        expected.storage.legacy === current.legacy) {
        removeAuthKeys([ACCESS_TOKEN_STORAGE_KEY]);
      }
      if (mock) removeAuthKeys([SESSION_STORAGE_KEY]);
    }
  };

  try {
    await withAuthLock({ ...expected, revision: operationRevision }, clearUnderLock);
  } catch {
    if (revision === operationRevision) {
      const current = captureAuth();
      if (explicit || current.storage.status === "unavailable" ||
        matchesAuth(expected.storage, current.storage, requireSameAccessToken)) {
        fencedRevision ??= fenceThisTab();
        if (mock) removeAuthKeys([SESSION_STORAGE_KEY]);
      }
    }
  }

  if (fencedRevision === undefined || revision !== fencedRevision) return false;
  if (!explicit) notifyAuthExpiry(expected, fencedRevision, false, redirect);
  return true;
}
