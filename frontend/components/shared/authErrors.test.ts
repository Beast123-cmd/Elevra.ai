import assert from "node:assert/strict";
import { test } from "node:test";
import { isTransientAuthError } from "./authErrors.ts";

test("network and server failures mean 'we could not check', not 'signed out'", () => {
  assert.equal(isTransientAuthError({ name: "AuthRetryableFetchError", message: "fetch failed", status: 0 }), true);
  assert.equal(isTransientAuthError({ name: "AuthUnknownError", message: "x", status: 503 }), true);
  assert.equal(isTransientAuthError({ name: "Error", message: "fetch failed" }), true);
  assert.equal(isTransientAuthError({ name: "Error", message: "ConnectTimeoutError: Connect Timeout Error" }), true);
  assert.equal(isTransientAuthError({ name: "Error", message: "ECONNRESET" }), true);
  assert.equal(isTransientAuthError({ message: "getaddrinfo ENOTFOUND project.supabase.co" }), true);
});

test("a missing, expired or invalid session is a real sign-out, never transient", () => {
  assert.equal(isTransientAuthError({ name: "AuthSessionMissingError", message: "Auth session missing!", status: 400 }), false);
  assert.equal(isTransientAuthError({ name: "AuthApiError", message: "invalid JWT", status: 401 }), false);
  assert.equal(isTransientAuthError({ name: "AuthApiError", message: "Forbidden", status: 403 }), false);
  assert.equal(isTransientAuthError({ name: "AuthInvalidJwtError", message: "Invalid JWT" }), false);
});

test("no error is not transient", () => {
  assert.equal(isTransientAuthError(null), false);
  assert.equal(isTransientAuthError(undefined), false);
});
