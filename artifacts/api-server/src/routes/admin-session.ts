import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreateAdminSessionBody,
  CreateAdminSessionResponse,
  DeleteAdminSessionResponse,
  GetAdminSessionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const COOKIE_NAME = "cinenova_admin";
const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getSigningSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

function signature(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function createSessionToken(secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ expiresAt: Date.now() + SESSION_MAX_AGE_MS }),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

function isValidSessionToken(token: unknown, secret: string): boolean {
  if (typeof token !== "string") return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra !== undefined) return false;

  const expectedSignature = signature(payload, secret);
  const suppliedBytes = Buffer.from(suppliedSignature, "utf8");
  const expectedBytes = Buffer.from(expectedSignature, "utf8");
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return false;
  }

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return (
      typeof decoded === "object" &&
      decoded !== null &&
      "expiresAt" in decoded &&
      typeof decoded.expiresAt === "number" &&
      decoded.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/admin",
  };
}

function getAttemptState(clientKey: string, now: number) {
  let attempt = loginAttempts.get(clientKey);
  if (!attempt || attempt.resetAt <= now) {
    attempt = { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
    loginAttempts.set(clientKey, attempt);
  }

  if (loginAttempts.size > 10_000) {
    for (const [key, value] of loginAttempts) {
      if (value.resetAt <= now) loginAttempts.delete(key);
    }
  }

  return attempt;
}

router.get("/admin/session", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const secret = getSigningSecret();
  const authenticated =
    secret !== null &&
    isValidSessionToken(req.cookies?.[COOKIE_NAME], secret);
  res.json(GetAdminSessionResponse.parse({ authenticated }));
});

router.post("/admin/session", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const adminPassword = process.env.CINENOVA_ADMIN_PASSWORD;
  const signingSecret = getSigningSecret();

  if (!adminPassword || !signingSecret) {
    res.status(503).json({ error: "Administrator authentication is not configured" });
    return;
  }

  const parsed = CreateAdminSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid login request" });
    return;
  }

  const now = Date.now();
  const clientKey = req.ip ?? "unknown";
  const attempt = getAttemptState(clientKey, now);
  if (attempt.count >= MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return;
  }

  const expected = createHmac("sha256", signingSecret)
    .update(adminPassword)
    .digest();
  const candidate = createHmac("sha256", signingSecret)
    .update(parsed.data.password)
    .digest();

  if (!timingSafeEqual(expected, candidate)) {
    attempt.count += 1;
    req.log.warn({ ip: clientKey }, "Administrator login denied");
    res.status(401).json({ error: "Access denied" });
    return;
  }

  loginAttempts.delete(clientKey);
  res.cookie(COOKIE_NAME, createSessionToken(signingSecret), {
    ...cookieOptions(),
    maxAge: SESSION_MAX_AGE_MS,
  });
  res.json(CreateAdminSessionResponse.parse({ authenticated: true }));
});

router.delete("/admin/session", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json(DeleteAdminSessionResponse.parse({ authenticated: false }));
});

export default router;
