const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const code = fs.readFileSync(path.join(__dirname, "..", "apps-script-versionado", "Code.gs"), "utf8");
const propertyValues = new Map();

function bytesForDigest(buffer) {
  return Array.from(buffer, (byte) => byte > 127 ? byte - 256 : byte);
}

const context = {
  console,
  Date,
  JSON,
  Math,
  String,
  Number,
  Boolean,
  Array,
  Object,
  Error,
  Utilities: {
    DigestAlgorithm: { SHA_256: "sha256" },
    Charset: { UTF_8: "utf8" },
    getUuid: () => "00000000-0000-4000-8000-000000000001",
    computeDigest: (_algorithm, value) => bytesForDigest(crypto.createHash("sha256").update(String(value), "utf8").digest()),
    computeHmacSha256Signature: (value, secret) => bytesForDigest(crypto.createHmac("sha256", String(secret)).update(String(value), "utf8").digest()),
    base64EncodeWebSafe: (value) => Buffer.from(String(value), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""),
    base64DecodeWebSafe: (value) => Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64"),
    newBlob: (value) => ({ getDataAsString: () => Buffer.from(value).toString("utf8") })
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => propertyValues.get(key) || null,
      setProperty: (key, value) => propertyValues.set(key, String(value))
    })
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  MimeType: { PLAIN_TEXT: "text/plain" },
  Session: { getScriptTimeZone: () => "UTC" },
  DriveApp: {},
  Logger: { log() {} }
};

vm.createContext(context);
vm.runInContext(code, context, { filename: "Code.gs" });

function emptyStore() {
  return { version: 1, users: [], clients: [], works: [], reports: [], dailyLogs: [], compositions: [] };
}

function storedUser(overrides = {}) {
  const user = {
    id: "usr_fixture",
    name: "Usuário fixture",
    email: "fixture@example.com",
    role: "user",
    passwordSalt: "salt-fixture",
    passwordHash: context.hashPassword_("fixture-password", "salt-fixture"),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
  if (Object.prototype.hasOwnProperty.call(overrides, "passwordHash") && overrides.passwordHash === undefined) {
    delete user.passwordHash;
  }
  return user;
}

test("usuário desconhecido é negado e não é criado", () => {
  const store = emptyStore();
  assert.throws(
    () => context.handleAuthLogin_({ email: "unknown@example.com", password: "any" }, store, "req-unknown"),
    (error) => error.code === "AUTH_DENIED"
  );
  assert.equal(store.users.length, 0);
});

test("role ausente é negada", () => {
  const user = storedUser({ email: "norole@example.com", role: "" });
  assert.throws(
    () => context.handleAuthLogin_({ email: user.email, password: "fixture-password" }, emptyStoreWith(user), "req-role"),
    (error) => error.code === "AUTH_DENIED"
  );
});

test("hash ausente é negado", () => {
  const user = storedUser({ email: "nohash@example.com", passwordHash: undefined });
  assert.throws(
    () => context.handleAuthLogin_({ email: user.email, password: "fixture-password" }, emptyStoreWith(user), "req-hash"),
    (error) => error.code === "AUTH_DENIED"
  );
});

test("usuário explícito autentica sem virar admin", () => {
  const user = storedUser({ email: "user@example.com", role: "user" });
  const login = context.handleAuthLogin_({ email: user.email, password: "fixture-password" }, emptyStoreWith(user), "req-user");
  assert.equal(login.ok, true);
  assert.equal(login.user.role, "user");
  assert.notEqual(login.user.role, "admin");
});

test("admin explícito autentica e auth.me retorna identidade", () => {
  const user = storedUser({ id: "usr_admin_fixture", email: "local@obrareport.app", role: "admin", name: "Admin fixture" });
  const store = emptyStoreWith(user);
  const login = context.handleAuthLogin_({ email: user.email, password: "fixture-password" }, store, "req-admin");
  const whoami = context.handleAuthMe_({ token: login.token }, store, "req-me-admin");
  assert.equal(whoami.authenticated, true);
  assert.equal(whoami.user.email, "local@obrareport.app");
  assert.equal(whoami.role, "admin");
});

test("auth.me sem sessão não expõe identidade", () => {
  const whoami = context.handleAuthMe_({}, emptyStore(), "req-me-anonymous");
  assert.equal(whoami.authenticated, false);
  assert.equal(whoami.user, null);
  assert.equal(whoami.role, null);
});

function emptyStoreWith(user) {
  const store = emptyStore();
  store.users.push(user);
  return store;
}
