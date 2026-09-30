const jwt = require("jsonwebtoken");

const SESSION_COOKIE = "app_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  return secret;
}

function signAppToken(user) {
  return jwt.sign(
    { login: user.login, name: user.name, avatar_url: user.avatar_url },
    getJwtSecret(),
    { algorithm: "HS256", subject: String(user.id), expiresIn: SESSION_MAX_AGE }
  );
}

function verifyAppToken(token) {
  if (!token) return null;

  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

function sessionCookie(token, isProduction = process.env.NODE_ENV === "production") {
  const secure = isProduction ? "; Secure" : "";
  const value = token
    ? `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE}`
    : `${SESSION_COOKIE}=; Max-Age=0`;

  return `${value}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

module.exports = { SESSION_COOKIE, sessionCookie, signAppToken, verifyAppToken };