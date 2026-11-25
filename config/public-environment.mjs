/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{ allowLocalHttp?: boolean }} [options]
 */
export function validatePublicEnvironment(env, { allowLocalHttp = false } = {}) {
  for (const name of ["NEXT_PUBLIC_USE_MOCK", "NEXT_PUBLIC_ENABLE_REGISTRATION_API"]) {
    const value = env[name];
    if (value !== undefined && value !== "true" && value !== "false") {
      throw new Error(`${name} must be "true" or "false" when set.`);
    }
  }

  if (env.NEXT_PUBLIC_USE_MOCK === "true") return;

  const baseUrl = env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl?.trim()) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be set in API mode.");
  }

  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    url = null;
  }
  const authority = /^https?:\/\/([^/]+)/i.exec(baseUrl)?.[1];
  const isLocalHttp = allowLocalHttp && url?.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

  if (!url || !authority || /[\s\\?#\p{Cc}]/u.test(baseUrl) || authority.includes("@") ||
    (url.protocol !== "https:" && !isLocalHttp)) {
    const protocol = allowLocalHttp ? "an absolute HTTPS URL or a loopback HTTP URL" : "an absolute HTTPS URL";
    throw new Error(`NEXT_PUBLIC_API_BASE_URL must be ${protocol} without credentials, a query, or a fragment.`);
  }
}
