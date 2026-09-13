import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import express from "express";

const MAX_CIPHERTEXT = 1024 * 1024;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export class PersistentMessengerStore {
  constructor(databasePath, options = {}) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.clock = options.clock || (() => Date.now());
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pseudonymous_identities (
        pseudonym_id TEXT PRIMARY KEY,
        public_key TEXT NOT NULL,
        signal_bundle TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS opaque_mailboxes (
        mailbox_id TEXT PRIMARY KEY,
        pseudonym_id TEXT NOT NULL REFERENCES pseudonymous_identities(pseudonym_id),
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activation_codes (
        code_hash TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        credits INTEGER NOT NULL CHECK (credits > 0),
        batch_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'UNUSED',
        redeemed_wallet_id TEXT,
        created_at INTEGER NOT NULL,
        redeemed_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS wallets (
        wallet_id TEXT PRIMARY KEY,
        pseudonym_id TEXT NOT NULL REFERENCES pseudonymous_identities(pseudonym_id),
        credits INTEGER NOT NULL CHECK (credits >= 0),
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invites (
        token_hash TEXT PRIMARY KEY,
        inviter_mailbox_id TEXT NOT NULL REFERENCES opaque_mailboxes(mailbox_id),
        inviter_public_key TEXT NOT NULL,
        inviter_signal_bundle TEXT,
        acceptor_signal_bundle TEXT,
        expires_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        consumed_at INTEGER,
        acceptor_mailbox_id TEXT
      );
      CREATE TABLE IF NOT EXISTS mailbox_messages (
        message_id TEXT PRIMARY KEY,
        sender_mailbox_id TEXT NOT NULL,
        recipient_mailbox_id TEXT NOT NULL REFERENCES opaque_mailboxes(mailbox_id),
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS receipts (
        receipt_id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES mailbox_messages(message_id),
        recipient_mailbox_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS mailbox_messages_fetch_idx ON mailbox_messages(recipient_mailbox_id, consumed_at, expires_at);
      CREATE INDEX IF NOT EXISTS invites_expiry_idx ON invites(expires_at, status);
      CREATE INDEX IF NOT EXISTS receipts_expiry_idx ON receipts(expires_at);
    `);
    for (const statement of ["ALTER TABLE pseudonymous_identities ADD COLUMN signal_bundle TEXT", "ALTER TABLE invites ADD COLUMN inviter_signal_bundle TEXT", "ALTER TABLE invites ADD COLUMN acceptor_signal_bundle TEXT"]) {
      try { this.db.exec(statement); } catch (error) { if (!String(error.message).includes("duplicate column name")) throw error; }
    }
  }

  now() { return this.clock(); }

  createIdentity({ pseudonymId, publicKey, signalBundle = null }) {
    const id = pseudonymId || `pseud_${crypto.randomUUID()}`;
    const existing = this.db.prepare("SELECT pseudonym_id AS pseudonymId, public_key AS publicKey, signal_bundle AS signalBundle FROM pseudonymous_identities WHERE pseudonym_id=?").get(id);
    if (existing) {
      this.db.prepare("UPDATE pseudonymous_identities SET public_key=?, signal_bundle=? WHERE pseudonym_id=?").run(publicKey, signalBundle, id);
      const mailbox = this.db.prepare("SELECT mailbox_id AS mailboxId FROM opaque_mailboxes WHERE pseudonym_id=? AND status='active'").get(id);
      return { pseudonymId: id, mailboxId: mailbox.mailboxId, publicKey, signalBundle };
    }
    this.db.prepare("INSERT INTO pseudonymous_identities(pseudonym_id, public_key, signal_bundle, created_at) VALUES(?,?,?,?)").run(id, publicKey, signalBundle, this.now());
    const mailboxId = `mbx_${randomToken(24)}`;
    this.db.prepare("INSERT INTO opaque_mailboxes(mailbox_id, pseudonym_id, created_at) VALUES(?,?,?)").run(mailboxId, id, this.now());
    return { pseudonymId: id, mailboxId, publicKey, signalBundle };
  }
  getIdentity(mailboxId) {
    return this.db.prepare("SELECT m.mailbox_id AS mailboxId, i.pseudonym_id AS pseudonymId, i.public_key AS publicKey, i.signal_bundle AS signalBundle FROM opaque_mailboxes m JOIN pseudonymous_identities i ON i.pseudonym_id=m.pseudonym_id WHERE m.mailbox_id=? AND m.status='active'").get(mailboxId) || null;
  }

  issueActivationCode({ batchId = "local-e2e", credits = 20, packageId = "ELO_PRIVATE_20" } = {}) {
    const code = `ELO-${randomToken(4)}-${randomToken(4)}-${randomToken(4)}`;
    this.db.prepare("INSERT INTO activation_codes(code_hash, package_id, credits, batch_id, created_at) VALUES(?,?,?,?,?)").run(hash(code), packageId, credits, batchId, this.now());
    return { code, packageId, credits, batchId };
  }

  redeem(code, pseudonymId) {
    const tx = this.db.prepare("SELECT * FROM activation_codes WHERE code_hash=?").get(hash(code));
    if (!tx) throw new Error("Código inválido.");
    if (tx.status !== "UNUSED") throw new Error("Código já utilizado.");
    const existing = this.db.prepare("SELECT * FROM wallets WHERE pseudonym_id=?").get(pseudonymId);
    const walletId = existing?.wallet_id || `wallet_${randomToken(18)}`;
    const nextCredits = (existing?.credits || 0) + tx.credits;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (existing) this.db.prepare("UPDATE wallets SET credits=? WHERE wallet_id=?").run(nextCredits, walletId);
      else this.db.prepare("INSERT INTO wallets(wallet_id,pseudonym_id,credits,created_at) VALUES(?,?,?,?)").run(walletId, pseudonymId, nextCredits, this.now());
      const updated = this.db.prepare("UPDATE activation_codes SET status='REDEEMED', redeemed_wallet_id=?, redeemed_at=? WHERE code_hash=? AND status='UNUSED'").run(walletId, this.now(), hash(code));
      if (updated.changes !== 1) throw new Error("Código já utilizado.");
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { walletId, credits: nextCredits, addedCredits: tx.credits };
  }

  wallet(pseudonymId) { return this.db.prepare("SELECT wallet_id AS walletId, pseudonym_id AS pseudonymId, credits FROM wallets WHERE pseudonym_id=?").get(pseudonymId) || null; }

  createInvite(inviterMailboxId, ttlSeconds = 900, scheme = "elo") {
    if (scheme !== "elo" && scheme !== "elo-e2e") throw new Error("unsupported invite scheme");
    const inviter = this.getIdentity(inviterMailboxId);
    if (!inviter) throw new Error("Mailbox indisponível.");
    const token = randomToken(32);
    this.db.prepare("INSERT INTO invites(token_hash,inviter_mailbox_id,inviter_public_key,inviter_signal_bundle,expires_at) VALUES(?,?,?,?,?)").run(hash(token), inviterMailboxId, inviter.publicKey, inviter.signalBundle, this.now() + ttlSeconds * 1000);
    return { token, link: `${scheme}://invite/${token}`, expiresAt: this.now() + ttlSeconds * 1000 };
  }

  acceptInvite(token, acceptorMailboxId, acceptorSignalBundle = null) {
    const invite = this.db.prepare("SELECT * FROM invites WHERE token_hash=?").get(hash(token));
    if (!invite || invite.status !== "ACTIVE" || invite.expires_at <= this.now()) throw new Error("Convite indisponível.");
    const acceptor = this.getIdentity(acceptorMailboxId);
    if (!acceptor) throw new Error("Mailbox indisponível.");
    const result = this.db.prepare("UPDATE invites SET status='CONSUMED', consumed_at=?, acceptor_mailbox_id=?, acceptor_signal_bundle=? WHERE token_hash=? AND status='ACTIVE'").run(this.now(), acceptorMailboxId, acceptorSignalBundle, hash(token));
    if (result.changes !== 1) throw new Error("Convite indisponível.");
    return { inviterMailboxId: invite.inviter_mailbox_id, inviterPublicKey: invite.inviter_public_key, inviterSignalBundle: invite.inviter_signal_bundle, acceptorMailboxId, acceptorSignalBundle };
  }

  lookupInviteBundle(token, requesterMailboxId) {
    const invite = this.db.prepare("SELECT * FROM invites WHERE token_hash=? AND status='CONSUMED'").get(hash(token));
    if (!invite || invite.expires_at <= this.now()) throw new Error("Convite indisponível.");
    if (requesterMailboxId === invite.inviter_mailbox_id) return { mailboxId: invite.acceptor_mailbox_id, signalBundle: invite.acceptor_signal_bundle };
    if (requesterMailboxId === invite.acceptor_mailbox_id) return { mailboxId: invite.inviter_mailbox_id, signalBundle: invite.inviter_signal_bundle };
    throw new Error("Vínculo indisponível.");
  }

  listPeerBundles(requesterMailboxId) {
    const rows = this.db.prepare(`
      SELECT inviter_mailbox_id, acceptor_mailbox_id, inviter_signal_bundle,
             acceptor_signal_bundle, consumed_at
      FROM invites
      WHERE status='CONSUMED'
        AND (inviter_mailbox_id=? OR acceptor_mailbox_id=?)
      ORDER BY consumed_at DESC
    `).all(requesterMailboxId, requesterMailboxId);
    const seen = new Set();
    return rows.flatMap((row) => {
      const requesterIsInviter = requesterMailboxId === row.inviter_mailbox_id;
      const peerMailboxId = requesterIsInviter ? row.acceptor_mailbox_id : row.inviter_mailbox_id;
      const currentPeer = this.getIdentity(peerMailboxId);
      const signalBundle = currentPeer?.signalBundle || (requesterIsInviter ? row.acceptor_signal_bundle : row.inviter_signal_bundle);
      if (!peerMailboxId || !signalBundle || seen.has(peerMailboxId)) return [];
      seen.add(peerMailboxId);
      return [{
        relationshipId: relationshipId(requesterMailboxId, peerMailboxId),
        peerMailboxId,
        signalBundle,
        establishedAt: row.consumed_at
      }];
    });
  }

  sendMessage({ senderMailboxId, recipientMailboxId, ciphertext, nonce, algorithm = "x25519-xsalsa20poly1305", ttlSeconds = DEFAULT_TTL_SECONDS }) {
    if (!ciphertext || Buffer.byteLength(ciphertext, "utf8") > MAX_CIPHERTEXT) throw new Error("Ciphertext inválido.");
    if (!nonce) throw new Error("Nonce obrigatório.");
    if (!this.getIdentity(recipientMailboxId)) throw new Error("Mailbox indisponível.");
    const messageId = `msg_${crypto.randomUUID()}`;
    this.db.prepare("INSERT INTO mailbox_messages(message_id,sender_mailbox_id,recipient_mailbox_id,ciphertext,nonce,algorithm,expires_at) VALUES(?,?,?,?,?,?,?)").run(messageId, senderMailboxId, recipientMailboxId, ciphertext, nonce, algorithm, this.now() + Math.min(Math.max(ttlSeconds, 60), 30 * 24 * 60 * 60) * 1000);
    return { messageId };
  }

  fetchMessages(mailboxId) {
    this.cleanup();
    return this.db.prepare("SELECT message_id AS messageId,sender_mailbox_id AS senderMailboxId,recipient_mailbox_id AS recipientMailboxId,ciphertext,nonce,algorithm,expires_at AS expiresAt FROM mailbox_messages WHERE recipient_mailbox_id=? AND consumed_at IS NULL AND expires_at>? ORDER BY expires_at").all(mailboxId, this.now());
  }

  receipt({ messageId, mailboxId, kind, payload, ttlSeconds = DEFAULT_TTL_SECONDS }) {
    if (!["DELIVERY_ACK", "READ_ACK"].includes(kind)) throw new Error("Receipt inválido.");
    const message = this.db.prepare("SELECT * FROM mailbox_messages WHERE message_id=? AND recipient_mailbox_id=?").get(messageId, mailboxId);
    if (!message) throw new Error("Mensagem indisponível.");
    const receiptId = `rcpt_${crypto.randomUUID()}`;
    this.db.prepare("INSERT INTO receipts(receipt_id,message_id,recipient_mailbox_id,kind,payload,expires_at,created_at) VALUES(?,?,?,?,?,?,?)").run(receiptId, messageId, mailboxId, kind, payload, this.now() + ttlSeconds * 1000, this.now());
    if (kind === "READ_ACK") this.db.prepare("UPDATE mailbox_messages SET consumed_at=? WHERE message_id=?").run(this.now(), messageId);
    return { receiptId };
  }

  fetchReceipts(mailboxId) {
    this.cleanup();
    return this.db.prepare("SELECT r.receipt_id AS receiptId,r.message_id AS messageId,r.kind,r.payload,r.expires_at AS expiresAt FROM receipts r JOIN mailbox_messages m ON m.message_id=r.message_id WHERE m.sender_mailbox_id=? AND r.expires_at>? ORDER BY r.created_at").all(mailboxId, this.now());
  }

  close() { this.db.close(); }

  cleanup() {
    const now = this.now();
    this.db.prepare("UPDATE invites SET status='EXPIRED' WHERE status='ACTIVE' AND expires_at<=?").run(now);
    this.db.prepare("DELETE FROM receipts WHERE expires_at<=?").run(now);
      this.db.prepare("DELETE FROM mailbox_messages WHERE (expires_at<=? AND NOT EXISTS (SELECT 1 FROM receipts WHERE receipts.message_id=mailbox_messages.message_id)) OR (consumed_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM receipts WHERE receipts.message_id=mailbox_messages.message_id))").run(now);
  }
}

export function registerLocalMessengerRoutes(app, options = {}) {
  const store = options.store;
  const router = express.Router();
  const challenges = new Map();
  router.get("/health", (_req, res) => res.json({ ok: true, service: "elo-messenger" }));
  router.post("/identities", (req, res) => handle(res, () => store.createIdentity(req.body || {})));
  if (process.env.NODE_ENV !== "production") router.post("/activation/issue", (req, res) => handle(res, () => store.issueActivationCode(req.body || {})));
  router.post("/identities/:mailboxId/challenge", (req, res) => handle(res, () => issueChallenge(store, challenges, req.params.mailboxId)));
  router.post("/activation/redeem", (req, res) => withCapability(req, res, store, challenges, req.body.mailboxId, () => {
    const identity = store.getIdentity(req.body.mailboxId);
    if (!identity || identity.pseudonymId !== req.body.pseudonymId) throw new Error("Capability inválida.");
    return store.redeem(req.body.code, req.body.pseudonymId);
  }));
  router.get("/wallets/:pseudonymId", (req, res) => withCapability(req, res, store, challenges, req.headers["x-elo-mailbox"], () => {
    const identity = store.getIdentity(req.headers["x-elo-mailbox"]);
    if (!identity || identity.pseudonymId !== req.params.pseudonymId) throw new Error("Capability inválida.");
    return store.wallet(req.params.pseudonymId);
  }));
  router.post("/invites", (req, res) => withCapability(req, res, store, challenges, req.body.mailboxId, () => store.createInvite(req.body.mailboxId, req.body.ttlSeconds, req.body.scheme)));
  router.post("/invites/:token/accept", (req, res) => withCapability(req, res, store, challenges, req.body.mailboxId, () => store.acceptInvite(req.params.token, req.body.mailboxId, req.body.signalBundle || null)));
  router.post("/invites/:token/bundle", (req, res) => withCapability(req, res, store, challenges, req.body.mailboxId, () => store.lookupInviteBundle(req.params.token, req.body.mailboxId)));
  router.post("/relationships/peers", (req, res) => withCapability(req, res, store, challenges, req.body.mailboxId, () => store.listPeerBundles(req.body.mailboxId)));
  router.post("/mailboxes/:mailboxId/messages", (req, res) => withCapability(req, res, store, challenges, req.body.senderMailboxId, () => store.sendMessage({ ...req.body, recipientMailboxId: req.params.mailboxId })));
  router.get("/mailboxes/:mailboxId/messages", (req, res) => withCapability(req, res, store, challenges, req.params.mailboxId, () => store.fetchMessages(req.params.mailboxId)));
  router.post("/mailboxes/:mailboxId/receipts", (req, res) => withCapability(req, res, store, challenges, req.params.mailboxId, () => store.receipt({ ...req.body, mailboxId: req.params.mailboxId })));
  router.get("/mailboxes/:mailboxId/receipts", (req, res) => withCapability(req, res, store, challenges, req.params.mailboxId, () => store.fetchReceipts(req.params.mailboxId)));
  app.use(options.basePath || "/api/elo-messenger-local", router);
  return router;
}

function issueChallenge(store, challenges, mailboxId) {
  if (!store.getIdentity(mailboxId)) throw new Error("Mailbox indisponível.");
  const challenge = crypto.randomBytes(32).toString("base64url");
  challenges.set(challenge, { mailboxId, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  return { challenge };
}

function withCapability(request, response, store, challenges, mailboxId, operation) {
  try {
    const identity = store.getIdentity(mailboxId);
    const challenge = String(request.headers["x-elo-challenge"] || "");
    const signature = String(request.headers["x-elo-signature"] || "");
    if (!identity || !challenge || !signature) throw new Error("Capability inválida.");
    const pending = challenges.get(challenge);
    challenges.delete(challenge);
    if (!pending || pending.mailboxId !== mailboxId || pending.expiresAt <= Date.now()) throw new Error("Capability inválida.");
    const valid = crypto.verify(null, Buffer.from(challenge), identity.publicKey, Buffer.from(signature, "base64url"));
    if (!valid) throw new Error("Capability inválida.");
    handle(response, operation);
  } catch (error) {
    response.status(401).json({ ok: false, error: String(error.message || "Capability inválida.") });
  }
}
function handle(response, operation) {
  try { response.status(200).json({ ok: true, data: operation() }); }
  catch (error) { response.status(400).json({ ok: false, error: String(error.message || "Operação indisponível.") }); }
}

function hash(value) { return crypto.createHash("sha256").update(String(value)).digest("base64url"); }
function relationshipId(firstMailboxId, secondMailboxId) {
  return `rel_${hash([firstMailboxId, secondMailboxId].sort().join("|"))}`;
}
function randomToken(bytes) { return crypto.randomBytes(bytes).toString("base64url"); }
