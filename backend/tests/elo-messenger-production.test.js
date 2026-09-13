import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { PersistentMessengerStore } from "../src/elo-messenger-local.js";

async function requestJson(baseUrl, path, init = {}) {
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });
  return { response, body: await response.json() };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function capability(baseUrl, mailboxId, privateKey) {
  const challenge = await requestJson(
    baseUrl,
    `/api/elo-messenger/identities/${mailboxId}/challenge`,
    { method: "POST" }
  );
  assert.equal(challenge.response.status, 200);
  const value = challenge.body.data.challenge;
  return {
    "x-elo-challenge": value,
    "x-elo-signature": crypto.sign(
      null,
      Buffer.from(value),
      privateKey
    ).toString("base64url")
  };
}

test("official persistent health and alias are rate limited", async () => {
  const dir = mkdtempSync(join(tmpdir(), "elo-messenger-production-"));
  const store = new PersistentMessengerStore(join(dir, "messenger.sqlite"));
  const app = createApp({
    env: {
      NODE_ENV: "production",
      ELO_MESSENGER_RATE_LIMIT_MAX: "2",
      ELO_MESSENGER_RATE_LIMIT_WINDOW_MS: "60000"
    },
    eloMessengerLocalStore: store,
    eloMessengerLocalBasePath: "/api/elo-messenger",
    eloMessengerLocalAlias: "/api/elo-messenger-local"
  });
  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const official = await requestJson(baseUrl, "/api/elo-messenger/health");
    const alias = await requestJson(baseUrl, "/api/elo-messenger-local/health");
    const limited = await requestJson(baseUrl, "/api/elo-messenger/health");

    assert.equal(official.response.status, 200);
    assert.deepEqual(official.body, { ok: true, service: "elo-messenger" });
    assert.equal(alias.response.status, 200);
    assert.deepEqual(alias.body, { ok: true, service: "elo-messenger" });
    assert.equal(limited.response.status, 429);
  } finally {
    await close(server);
    store.close();
    try {
      rmSync(dir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200
      });
    } catch (error) {
      if (!["EPERM", "EBUSY"].includes(error?.code)) throw error;
      console.warn(`cleanup warning ignored: ${error.code} ${dir}`);
    }
  }
});

test("official persistent route covers invite, bundle, mailbox, receipts, TTL and restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "elo-messenger-production-"));
  const db = join(dir, "messenger.sqlite");
  let now = 1_000_000;
  let store;
  let server;

  try {
    store = new PersistentMessengerStore(db, { clock: () => now });
    const app = createApp({
      env: {
        NODE_ENV: "production",
        ELO_MESSENGER_RATE_LIMIT_MAX: "1000"
      },
      eloMessengerLocalStore: store,
      eloMessengerLocalBasePath: "/api/elo-messenger",
      eloMessengerLocalAlias: "/api/elo-messenger-local"
    });
    server = await listen(app);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const keyA = crypto.generateKeyPairSync("ed25519");
    const keyB = crypto.generateKeyPairSync("ed25519");
    const publicKeyA = keyA.publicKey.export({ type: "spki", format: "pem" });
    const publicKeyB = keyB.publicKey.export({ type: "spki", format: "pem" });

    const identityA = await requestJson(baseUrl, "/api/elo-messenger/identities", {
      method: "POST",
      body: JSON.stringify({
        pseudonymId: "production-a",
        publicKey: publicKeyA,
        signalBundle: "prekey-a-1"
      })
    });
    const identityB = await requestJson(baseUrl, "/api/elo-messenger/identities", {
      method: "POST",
      body: JSON.stringify({
        pseudonymId: "production-b",
        publicKey: publicKeyB,
        signalBundle: "prekey-b-1"
      })
    });
    assert.equal(identityA.response.status, 200);
    assert.equal(identityB.response.status, 200);

    const a = identityA.body.data;
    const b = identityB.body.data;
    const headersA = await capability(baseUrl, a.mailboxId, keyA.privateKey);
    const headersB = await capability(baseUrl, b.mailboxId, keyB.privateKey);

    const invite = await requestJson(baseUrl, "/api/elo-messenger/invites", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        mailboxId: a.mailboxId,
        ttlSeconds: 900,
        scheme: "elo-e2e"
      })
    });
    assert.equal(invite.response.status, 200);

    const accepted = await requestJson(
      baseUrl,
      `/api/elo-messenger/invites/${invite.body.data.token}/accept`,
      {
        method: "POST",
        headers: headersB,
        body: JSON.stringify({
          mailboxId: b.mailboxId,
          signalBundle: "prekey-b-1"
        })
      }
    );
    assert.equal(accepted.response.status, 200);

    const secondAccept = await requestJson(
      baseUrl,
      `/api/elo-messenger/invites/${invite.body.data.token}/accept`,
      {
        method: "POST",
        headers: await capability(baseUrl, b.mailboxId, keyB.privateKey),
        body: JSON.stringify({ mailboxId: b.mailboxId })
      }
    );
    assert.equal(secondAccept.response.status, 400);

    const bundle = await requestJson(
      baseUrl,
      `/api/elo-messenger/invites/${invite.body.data.token}/bundle`,
      {
        method: "POST",
        headers: await capability(baseUrl, a.mailboxId, keyA.privateKey),
        body: JSON.stringify({ mailboxId: a.mailboxId })
      }
    );
    assert.equal(bundle.response.status, 200);
    assert.equal(bundle.body.data.mailboxId, b.mailboxId);

    const updatedB = await requestJson(baseUrl, "/api/elo-messenger/identities", {
      method: "POST",
      body: JSON.stringify({
        pseudonymId: "production-b",
        publicKey: publicKeyB,
        signalBundle: "prekey-b-2"
      })
    });
    assert.equal(updatedB.response.status, 200);

    const peers = await requestJson(baseUrl, "/api/elo-messenger/relationships/peers", {
      method: "POST",
      headers: await capability(baseUrl, a.mailboxId, keyA.privateKey),
      body: JSON.stringify({ mailboxId: a.mailboxId })
    });
    assert.equal(peers.response.status, 200);
    assert.equal(peers.body.data[0].signalBundle, "prekey-b-2");

    const message = await requestJson(
      baseUrl,
      `/api/elo-messenger/mailboxes/${b.mailboxId}/messages`,
      {
        method: "POST",
        headers: await capability(baseUrl, a.mailboxId, keyA.privateKey),
        body: JSON.stringify({
          senderMailboxId: a.mailboxId,
          ciphertext: "sealed-ciphertext",
          nonce: "sealed-nonce",
          algorithm: "x25519-xsalsa20poly1305",
          ttlSeconds: 120
        })
      }
    );
    assert.equal(message.response.status, 200);

    const fetched = await requestJson(
      baseUrl,
      `/api/elo-messenger/mailboxes/${b.mailboxId}/messages`,
      {
        headers: await capability(baseUrl, b.mailboxId, keyB.privateKey)
      }
    );
    assert.equal(fetched.response.status, 200);
    assert.equal(fetched.body.data[0].ciphertext, "sealed-ciphertext");

    for (const kind of ["DELIVERY_ACK", "READ_ACK"]) {
      const receipt = await requestJson(
        baseUrl,
        `/api/elo-messenger/mailboxes/${b.mailboxId}/receipts`,
        {
          method: "POST",
          headers: await capability(baseUrl, b.mailboxId, keyB.privateKey),
          body: JSON.stringify({
            mailboxId: b.mailboxId,
            messageId: message.body.data.messageId,
            kind,
            payload: `sealed-${kind.toLowerCase()}`
          })
        }
      );
      assert.equal(receipt.response.status, 200);
    }

    const receipts = await requestJson(
      baseUrl,
      `/api/elo-messenger/mailboxes/${a.mailboxId}/receipts`,
      {
        headers: await capability(baseUrl, a.mailboxId, keyA.privateKey)
      }
    );
    assert.equal(receipts.response.status, 200);
    assert.equal(receipts.body.data.length, 2);

    const expiringInvite = await requestJson(baseUrl, "/api/elo-messenger/invites", {
      method: "POST",
      headers: await capability(baseUrl, a.mailboxId, keyA.privateKey),
      body: JSON.stringify({ mailboxId: a.mailboxId, ttlSeconds: 1 })
    });
    assert.equal(expiringInvite.response.status, 200);
    now += 2_000;

    const expiredAccept = await requestJson(
      baseUrl,
      `/api/elo-messenger/invites/${expiringInvite.body.data.token}/accept`,
      {
        method: "POST",
        headers: await capability(baseUrl, b.mailboxId, keyB.privateKey),
        body: JSON.stringify({ mailboxId: b.mailboxId })
      }
    );
    assert.equal(expiredAccept.response.status, 400);

    const mailboxColumns = store.db
      .prepare("PRAGMA table_info(mailbox_messages)")
      .all();
    assert.ok(mailboxColumns.some(({ name }) => name === "ciphertext"));
    const forbiddenColumns = mailboxColumns.filter(({ name }) => {
      const normalized = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalized === "plain"
        || normalized === "text"
        || normalized === "body"
        || normalized.includes("plaintext")
        || normalized.includes("privatekey")
        || normalized.includes("messagebody")
        || normalized.includes("messagetext");
    });
    assert.equal(forbiddenColumns.length, 0);
    assert.equal(
      store.db
        .prepare("SELECT COUNT(*) AS count FROM mailbox_messages WHERE ciphertext=?")
        .get("plain-secret").count,
      0
    );

    await close(server);
    server = null;
    store.close();
    store = null;

    const restarted = new PersistentMessengerStore(db, { clock: () => now });
    assert.ok(restarted.getIdentity(a.mailboxId));
    assert.equal(restarted.fetchReceipts(a.mailboxId).length, 2);
    restarted.close();
  } finally {
    if (server) await close(server);
    store?.close();
    try {
      rmSync(dir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200
      });
    } catch (error) {
      if (!["EPERM", "EBUSY"].includes(error?.code)) throw error;
      console.warn(`cleanup warning ignored: ${error.code} ${dir}`);
    }
  }
});