import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { Session } from "@shopify/shopify-api";
import { createSessionMigration } from "../.cache/auth-tests/session-migration.server.js";

const shop = "example.myshopify.com";
const id = `offline_${shop}`;

function session(overrides = {}) {
  return new Session({
    id,
    shop,
    state: "state",
    isOnline: false,
    accessToken: "token",
    ...overrides,
  });
}

function storage(initial) {
  const rows = new Map(initial ? [[initial.id, initial]] : []);
  return {
    rows,
    async storeSession(value) { rows.set(value.id, value); return true; },
    async loadSession(key) { return rows.get(key); },
    async deleteSession(key) { return rows.delete(key); },
    async deleteSessions(keys) { keys.forEach((key) => rows.delete(key)); return true; },
    async findSessionsByShop(value) { return [...rows.values()].filter((row) => row.shop === value); },
  };
}

function request() {
  const payload = Buffer.from(JSON.stringify({ dest: `https://${shop}` })).toString("base64url");
  return new Request("https://content-bridge.test/app", {
    headers: { authorization: `Bearer header.${payload}.signature` },
  });
}

test("legacy offline session is hidden only during admin authentication", async () => {
  const base = storage(session());
  const migration = createSessionMigration(base);
  const authenticate = migration.wrapAdmin(async () => {
    const found = await migration.sessionStorage.loadSession(id);
    assert.equal(found, undefined);
    const replacement = session({
      expires: new Date(Date.now() + 60 * 60 * 1000),
      refreshToken: "refresh",
      refreshTokenExpires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });
    await migration.sessionStorage.storeSession(replacement);
    return replacement;
  });

  await authenticate(request());
  assert.ok((await migration.sessionStorage.loadSession(id)).expires);
});

test("existing expiring session is reused without migration", async () => {
  const current = session({ expires: new Date(Date.now() + 60 * 60 * 1000), refreshToken: "refresh" });
  const base = storage(current);
  const migration = createSessionMigration(base);
  let calls = 0;
  const authenticate = migration.wrapAdmin(async () => {
    calls += 1;
    assert.equal(await migration.sessionStorage.loadSession(id), current);
    return current;
  });

  await authenticate(request());
  assert.equal(calls, 1);
});

test("concurrent legacy requests perform one exchange", async () => {
  const base = storage(session());
  const migration = createSessionMigration(base);
  let exchanges = 0;
  const authenticate = migration.wrapAdmin(async () => {
    const found = await migration.sessionStorage.loadSession(id);
    if (!found) {
      exchanges += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      await migration.sessionStorage.storeSession(session({
        expires: new Date(Date.now() + 60 * 60 * 1000),
        refreshToken: "refresh",
      }));
    }
    return true;
  });

  await Promise.all([authenticate(request()), authenticate(request())]);
  assert.equal(exchanges, 1);
});

test("failed exchange preserves the legacy session and permits retry", async () => {
  const legacy = session();
  const base = storage(legacy);
  const migration = createSessionMigration(base);
  const failing = migration.wrapAdmin(async () => { throw new Error("exchange failed"); });

  await assert.rejects(failing(request()), /exchange failed/);
  assert.equal(await migration.sessionStorage.loadSession(id), legacy);

  let retried = false;
  const retry = migration.wrapAdmin(async () => { retried = true; return true; });
  await retry(request());
  assert.equal(retried, true);
});

test("webhook and background reads retain legacy sessions", async () => {
  const legacy = session();
  const base = storage(legacy);
  const migration = createSessionMigration(base);
  assert.equal(await migration.sessionStorage.loadSession(id), legacy);
});
