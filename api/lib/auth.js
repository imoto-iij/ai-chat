import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false";
const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS
  ? process.env.ALLOWED_EMAILS.split(",").map((e) => e.trim().toLowerCase())
  : [];

const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID);

export function isAuthEnabled() {
  return AUTH_ENABLED;
}

export function getAuthConfig() {
  return {
    clientId: GOOGLE_CLIENT_ID,
    authEnabled: AUTH_ENABLED,
  };
}

export function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const [name, ...rest] = cookie.split("=");
      cookies[name.trim()] = rest.join("=").trim();
    });
  }
  return cookies;
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export async function verifyGoogleToken(credential) {
  const ticket = await oauth2Client.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

export function isEmailAllowed(email) {
  if (ALLOWED_EMAILS.length === 0) {
    return true;
  }
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `auth_token=${token}; HttpOnly; ${isProduction ? "Secure; " : ""}SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Path=/`
  );
}

export function clearAuthCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "auth_token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/"
  );
}

export function checkAuth(req) {
  if (!AUTH_ENABLED) {
    return { authenticated: true, user: null };
  }

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.auth_token;

  if (!token) {
    return { authenticated: false, user: null };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return { authenticated: false, user: null };
  }

  return {
    authenticated: true,
    user: {
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    },
  };
}
