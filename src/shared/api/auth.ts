export const SESSION_STORAGE_KEY = "piston-auth";
export const ACCESS_TOKEN_STORAGE_KEY = "piston-access-token";
export const API_SESSION_STORAGE_KEY = "piston-api-session";
export const AUTH_EXPIRED_EVENT = "piston-auth-expired";

const BLOCKED_AUTH_KEY = "piston-auth-cleanup-failed";
const RESET_SESSION_KEY_PREFIX = "piston-auth-reset-session:";
const RESET_LEGACY_KEY = "piston-auth-reset-legacy";
const AUTH_LOCK = "piston-auth-storage";
export const AUTH_WAIT_TIMEOUT_MS = 5_000;

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
const resetAuthBlocks = new Set<string>();

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

function resetAuthKey(sessionId: string | null, hasLegacyToken: boolean) {
  if (sessionId !== null) return RESET_SESSION_KEY_PREFIX + sessionId;
  return hasLegacyToken ? RESET_LEGACY_KEY : null;
}

export function blockResetAuth(snapshot: AuthSnapshot, sessionId: string | null) {
  const key = resetAuthKey(sessionId, snapshot.accessToken !== null);
  if (!key) return;
  resetAuthBlocks.add(key);
  try {
    // This marker must be visible to a new document before the async cleanup starts.
    window.localStorage.setItem(key, "true");
  } catch {
    // The current document still blocks this session if the marker cannot be persisted.
  }
}

export function isResetAuthBlocked({ session, accessToken }: Pick<AuthSnapshot, "session" | "accessToken">) {
  const key = resetAuthKey(session?.id ?? null, accessToken !== null);
  // undefined indicates a storage failure; only null means there is no marker.
  return key !== null && typeof window !== "undefined" &&
    (resetAuthBlocks.has(key) || readAuthKey(key) !== null);
}

function removeResetAuthBlock(sessionId: string | null, hasLegacyToken: boolean) {
  const key = resetAuthKey(sessionId, hasLegacyToken);
  if (!key || (!resetAuthBlocks.has(key) && readAuthKey(key) === null)) return;
  try {
    window.localStorage.removeItem(key);
    resetAuthBlocks.delete(key);
  } catch {
    // Keep the block if removal cannot be confirmed.
  }
}

export function captureAuth(includeLegacy = false): AuthSnapshot {
  const storage: StoredAuth = getAuthLocks() && !isStoredAuthBlocked()
    ? readStoredAuth(includeLegacy)
    : { status: "unavailable" };
  if (storage.status === "readable" && isResetAuthBlocked(storage)) return snapshotOf({ status: "unavailable" });
  return snapshotOf(storage);
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

function notifyAuthExpiry(sessionId: string | null, fencedRevision: number, explicit = false, redirect = false) {
  const event = new AuthExpiredEvent(fencedRevision, sessionId, explicit);
  if (!isCurrentAuthExpiry(event)) return;
  window.dispatchEvent(event);
  if (redirect && isCurrentAuthExpiry(event, true) && window.location.pathname !== "/login") {
    window.location.assign(window.location.origin + "/login");
  }
}

export function blockUnverifiedAuth(snapshot: AuthSnapshot) {
  if (typeof window === "undefined" || !isCurrentAuthRevision(snapshot)) return;
  notifyAuthExpiry(snapshot.session?.id ?? null, fenceThisTab());
}

function denyAuthLock(snapshot: AuthSnapshot) {
  if (lockAccess === "denied" || isResetAuthBlocked(snapshot)) return;
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
    pendingLockCheck = withAuthLock(snapshot, () => true, AbortSignal.timeout(AUTH_WAIT_TIMEOUT_MS))
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
    removeResetAuthBlock(current.session?.id ?? null, current.accessToken !== null);
    allowStoredAuthAfterLogin();
    return id;
  }, signal);
}

export async function updateApiAccessToken(snapshot: AuthSnapshot, accessToken: string) {
  return withAuthLock(snapshot, () => {
    if (!snapshot.session || !isCurrentAuthRevision(snapshot) || isStoredAuthBlocked() || isResetAuthBlocked(snapshot)) return false;
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

function removeStoredAuth() {
  if (!removeAuthKeys([API_SESSION_STORAGE_KEY, ACCESS_TOKEN_STORAGE_KEY, SESSION_STORAGE_KEY])) return false;
  removeBlockedMarker();
  blockedInThisTab = undefined;
  return true;
}

type LocalSignOutResult = "cleared" | "replaced" | "unverified" | "login-pending";

export async function clearLocalSession(
  expected: AuthSnapshot,
  sessionId: string | null,
  isLoginPending: () => boolean,
): Promise<LocalSignOutResult> {
  // A failed login advances the revision without changing the stored session ID.
  const attempt = { ...expected, revision };
  const lockDeadline = AbortSignal.timeout(AUTH_WAIT_TIMEOUT_MS);
  const hasLegacyToken = expected.accessToken !== null;
  const ownerKnown = sessionId !== null || hasLegacyToken;
  let fencedRevision: number | undefined;
  try {
    const result = await withAuthLock(attempt, (): LocalSignOutResult => {
      lockDeadline.throwIfAborted();
      if (isLoginPending()) return "login-pending";

      const current = readStoredAuth();
      if (current.status === "unavailable" || (current.record !== null && !current.session)) {
        fencedRevision = fenceThisTab();
        return "unverified";
      }
      if (!current.session && !current.accessToken) {
        removeResetAuthBlock(sessionId, hasLegacyToken);
        return "cleared";
      }
      if (sessionId ? current.session?.id !== sessionId : !matchesAuth(expected.storage, current)) {
        if (sessionId || expected.storage.status === "readable") {
          removeResetAuthBlock(sessionId, hasLegacyToken);
          return "replaced";
        }
        fencedRevision = fenceThisTab();
        return "unverified";
      }

      fencedRevision = fenceThisTab();
      if (!removeStoredAuth()) return "unverified";
      removeResetAuthBlock(sessionId, hasLegacyToken);
      return "cleared";
    }, lockDeadline);

    if (fencedRevision !== undefined) notifyAuthExpiry(sessionId, fencedRevision);
    return result;
  } catch {
    if (isCurrentAuthRevision(attempt)) {
      const current = readStoredAuth();
      if (current.status === "readable" && current.session && current.session.id !== sessionId &&
        (sessionId !== null || expected.storage.status === "readable")) {
        // An unlocked read can prevent touching the replacement. It never grants auth.
        return "replaced";
      }
      // For a known owner, the reset marker already blocks that session across documents.
      notifyAuthExpiry(sessionId, ownerKnown ? revision : fenceThisTab());
    }
    return "unverified";
  }
}

export async function clearStoredAuth(
  expected: AuthSnapshot,
  { redirect = false, requireSameAccessToken = false, explicit = false, mock = false }: ClearAuthOptions = {},
) {
  if (typeof window === "undefined" || !isCurrentAuthRevision(expected) ||
    (!explicit && isResetAuthBlocked(expected))) return false;

  let fencedRevision: number | undefined;
  if (explicit) {
    fencedRevision = fenceThisTab();
    notifyAuthExpiry(expected.session?.id ?? null, fencedRevision, true, redirect);
  }
  const operationRevision = revision;
  const clearUnderLock = () => {
    if (revision !== operationRevision || (!explicit && isResetAuthBlocked(expected))) return;
    const current = readStoredAuth(explicit);
    if (matchesAuth(expected.storage, current, requireSameAccessToken)) {
      fencedRevision ??= fenceThisTab();
      removeStoredAuth();
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
    if (revision === operationRevision && (explicit || !isResetAuthBlocked(expected))) {
      const current = captureAuth();
      if (explicit || current.storage.status === "unavailable" ||
        matchesAuth(expected.storage, current.storage, requireSameAccessToken)) {
        fencedRevision ??= fenceThisTab();
        if (mock) removeAuthKeys([SESSION_STORAGE_KEY]);
      }
    }
  }

  if (fencedRevision === undefined || revision !== fencedRevision) return false;
  if (!explicit) notifyAuthExpiry(expected.session?.id ?? null, fencedRevision, false, redirect);
  return true;
}
