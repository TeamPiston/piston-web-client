import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePublicEnvironment } from "../config/public-environment.mjs";

const baseUrl = "NEXT_PUBLIC_API_BASE_URL";
const mock = "NEXT_PUBLIC_USE_MOCK";
const registration = "NEXT_PUBLIC_ENABLE_REGISTRATION_API";

test("production Mock settings do not require a base URL", () => {
  validatePublicEnvironment({ [mock]: "true", [registration]: "false" });
});

test("an unset Mock flag still selects API mode and requires a base URL", () => {
  assert.throws(() => validatePublicEnvironment({}), /NEXT_PUBLIC_API_BASE_URL must be set/);
});

test("API mode accepts an explicit HTTPS URL with an optional path", () => {
  validatePublicEnvironment({ [mock]: "false", [baseUrl]: "https://piston-api.invalid" });
  validatePublicEnvironment({ [registration]: "true", [baseUrl]: "https://piston-api.invalid:8443/v1/" });
});

for (const value of ["", "   ", undefined]) {
  test(`missing or blank base URL is rejected (${JSON.stringify(value)})`, () => {
    assert.throws(() => validatePublicEnvironment({ [mock]: "false", [baseUrl]: value }),
      /NEXT_PUBLIC_API_BASE_URL must be set/);
  });
}

for (const value of ["/api", "//piston-api.invalid", "piston-api.invalid", "https:///host.invalid",
  "https:/host.invalid", "https://", "http://api.invalid", "http://localhost:8080",
  "ftp://api.invalid", "https://api.invalid:bad", "https://api.invalid\\path",
  " https://api.invalid", "https://api.invalid/a?key=fixture", "https://api.invalid/#",
  "https://fixture:fixture@api.invalid", "https://@api.invalid"]) {
  test(`invalid API URL is rejected (${value})`, () => {
    assert.throws(() => validatePublicEnvironment({ [mock]: "false", [baseUrl]: value }),
      { message: "NEXT_PUBLIC_API_BASE_URL must be an absolute HTTPS URL without credentials, a query, or a fragment." });
  });
}

test("loopback HTTP requires development opt-in and a loopback host", () => {
  const options = { allowLocalHttp: true };
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    const env = { [baseUrl]: `http://${host}:8080/v1` };
    validatePublicEnvironment(env, options);
    assert.throws(() => validatePublicEnvironment(env), /absolute HTTPS URL/);
  }
  assert.throws(() => validatePublicEnvironment({ [baseUrl]: "http://localhost.example.invalid:8080" }, options),
    /loopback HTTP URL/);
});

for (const flag of [mock, registration]) {
  test(`unexpected ${flag} values fail without echoing the value`, () => {
    for (const value of ["", " true ", "TRUE", "fixture-secret-value"]) {
      assert.throws(() => validatePublicEnvironment({ [mock]: "true", [flag]: value }),
        { message: `${flag} must be "true" or "false" when set.` });
    }
  });
}
