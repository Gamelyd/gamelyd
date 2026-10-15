import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { SignJWT } from "jose";
import { isFresh, signaturePayload, verifyEd25519 } from "@/lib/whisperly/signing";
import { checkResetCode, compareVersions, hashResetCode, licenseStatus, moveEligibility } from "@/lib/whisperly/rules";
import { createRateLimiter } from "@/lib/whisperly/rateLimit";
import { signWlToken, verifyWlToken } from "@/lib/whisperly/tokens";
import { signupSchema } from "@/lib/whisperly/schemas";

function deviceKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { publicB64: publicKey.export({ format: "der", type: "spki" }).toString("base64"), privateKey };
}

const base = { method: "GET", path: "/api/whisperly/license", ts: String(Date.now()), nonce: randomBytes(16).toString("hex"), deviceId: "a".repeat(64), body: "" };

describe("device signatures", () => {
  test("a signature from the bound key verifies", () => {
    const k = deviceKey();
    const payload = signaturePayload(base);
    const sig = sign(null, Buffer.from(payload), k.privateKey).toString("base64");
    assert.equal(verifyEd25519(k.publicB64, payload, sig), true);
  });
  test("another Mac's key is rejected", () => {
    const k = deviceKey();
    const other = deviceKey();
    const payload = signaturePayload(base);
    const sig = sign(null, Buffer.from(payload), other.privateKey).toString("base64");
    assert.equal(verifyEd25519(k.publicB64, payload, sig), false);
  });
  test("tampering with the body, path or device breaks the signature", () => {
    const k = deviceKey();
    const sig = sign(null, Buffer.from(signaturePayload(base)), k.privateKey).toString("base64");
    for (const change of [{ body: '{"x":1}' }, { path: "/api/whisperly/admin/users" }, { deviceId: "b".repeat(64) }, { method: "POST" }]) {
      assert.equal(verifyEd25519(k.publicB64, signaturePayload({ ...base, ...change }), sig), false);
    }
  });
  test("old or future timestamps are not fresh", () => {
    const now = Date.now();
    assert.equal(isFresh(String(now - 30_000), now), true);
    assert.equal(isFresh(String(now - 5 * 60_000), now), false);
    assert.equal(isFresh(String(now + 5 * 60_000), now), false);
    assert.equal(isFresh("nonsense", now), false);
  });
  test("garbage keys and signatures are rejected, not thrown", () => {
    assert.equal(verifyEd25519("not-a-key", "x", "AAAA"), false);
  });
});

describe("moving to another Mac", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  test("the first move is allowed", () => {
    assert.deepEqual(moveEligibility([], now, 30), { allowed: true, nextMoveAt: null });
  });
  test("a second move within 30 days is blocked, with the next allowed date", () => {
    const r = moveEligibility([{ at: "2026-10-01T12:00:00Z", by: "USER" }], now, 30);
    assert.equal(r.allowed, false);
    assert.equal(r.nextMoveAt, "2026-10-31T12:00:00.000Z");
  });
  test("after 30 days it's allowed again", () => {
    assert.equal(moveEligibility([{ at: "2026-09-01T12:00:00Z", by: "USER" }], now, 30).allowed, true);
  });
  test("admin resets don't count against the user", () => {
    assert.equal(moveEligibility([{ at: "2026-10-14T12:00:00Z", by: "ADMIN" }], now, 30).allowed, true);
  });
});

describe("reset codes", () => {
  const now = new Date();
  const later = new Date(Date.now() + 10 * 60_000).toISOString();
  const stored = hashResetCode("123456", "user-1");
  test("the right code works", () => {
    assert.equal(checkResetCode({ code: "123456", userId: "user-1", storedHash: stored, expiresAt: later }, now), "ok");
  });
  test("a wrong code, another user's code or a used (cleared) code fails", () => {
    assert.equal(checkResetCode({ code: "654321", userId: "user-1", storedHash: stored, expiresAt: later }, now), "invalid");
    assert.equal(checkResetCode({ code: "123456", userId: "user-2", storedHash: stored, expiresAt: later }, now), "invalid");
    assert.equal(checkResetCode({ code: "123456", userId: "user-1", storedHash: null, expiresAt: null }, now), "invalid");
  });
  test("an expired code fails", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    assert.equal(checkResetCode({ code: "123456", userId: "user-1", storedHash: stored, expiresAt: past }, now), "expired");
  });
});

describe("rate limiting", () => {
  test("blocks after max hits in the window, then resets", () => {
    const rl = createRateLimiter({ max: 3, windowMs: 1000 });
    assert.deepEqual([1, 2, 3, 4].map(() => rl.hit("k", 0)), [true, true, true, false]);
    assert.equal(rl.hit("other", 0), true);
    assert.equal(rl.hit("k", 1001), true);
  });
  test("blocked() checks without counting", () => {
    const rl = createRateLimiter({ max: 2, windowMs: 1000 });
    assert.equal(rl.blocked("k", 0), false);
    rl.hit("k", 0);
    assert.equal(rl.blocked("k", 0), false);
    rl.hit("k", 0);
    assert.equal(rl.blocked("k", 0), true);
    assert.equal(rl.blocked("k", 1001), false);
  });
});

describe("tokens", () => {
  const WL = "w".repeat(48);
  const GAMELYD = "g".repeat(48);
  test("a Whisperly access token verifies as access only", async () => {
    const t = await signWlToken({ sub: "u1", did: "d1", role: "USER", typ: "access" }, WL);
    assert.equal((await verifyWlToken(t, WL, "access"))?.sub, "u1");
    assert.equal(await verifyWlToken(t, WL, "refresh"), null);
  });
  test("a gamelyd token (other secret, no audience) is rejected", async () => {
    const gamelyd = await new SignJWT({ uid: "u1", user_type: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(GAMELYD));
    assert.equal(await verifyWlToken(gamelyd, WL, "access"), null);
    // Even signed with the Whisperly secret, a token without our audience/issuer is rejected.
    const noAud = await new SignJWT({ did: "d1", role: "ADMIN", typ: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(WL));
    assert.equal(await verifyWlToken(noAud, WL, "access"), null);
  });
  test("a Whisperly token is useless with gamelyd's secret", async () => {
    const t = await signWlToken({ sub: "u1", did: "d1", role: "USER", typ: "access" }, WL);
    assert.equal(await verifyWlToken(t, GAMELYD, "access"), null);
  });
});

describe("signup input", () => {
  test("a role or user_type in the request is ignored", () => {
    const parsed = signupSchema.parse({
      firstName: "Ada",
      email: "ADA@Example.com",
      password: "Str0ng!pass",
      role: "ADMIN",
      user_type: "ADMIN",
      device: { id: "a".repeat(64), publicKey: "x".repeat(60) },
    });
    assert.equal("role" in parsed, false);
    assert.equal("user_type" in parsed, false);
    assert.equal(parsed.email, "ada@example.com");
  });
  test("weak passwords are rejected", () => {
    const r = signupSchema.safeParse({ firstName: "A", email: "a@b.co", password: "password", device: { id: "a".repeat(64), publicKey: "x".repeat(60) } });
    assert.equal(r.success, false);
  });
});

describe("misc rules", () => {
  test("versions compare numerically", () => {
    assert.equal(compareVersions("0.2.10", "0.2.9"), 1);
    assert.equal(compareVersions("0.3.0", "0.3"), 0);
    assert.equal(compareVersions("0.2.11", "0.3.0"), -1);
  });
  test("an expired grant counts as EXPIRED", () => {
    const now = new Date();
    assert.equal(licenseStatus("ACTIVE", new Date(Date.now() - 1000).toISOString(), now), "EXPIRED");
    assert.equal(licenseStatus("ACTIVE", null, now), "ACTIVE");
    assert.equal(licenseStatus("PENDING", null, now), "PENDING");
  });
});
