const { randomBytes } = require("crypto");

const STATE_COOKIE = "github_oauth_state";

export default function githubLogin(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).end("Method not allowed");
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const appUrl = process.env.APP_URL;

  if (!clientId || !appUrl) {
    res.status(500).json({ error: "OAuth server configuration is incomplete" });
    return;
  }

  const state = randomBytes(32).toString("hex");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const callbackUri = `${appUrl.replace(/\/$/, "")}/api/auth/github/callback`;
  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");

  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", callbackUri);
  authorizationUrl.searchParams.set("scope", "read:user user:email");
  authorizationUrl.searchParams.set("state", state);

  res.setHeader(
    "Set-Cookie",
    `${STATE_COOKIE}=${state}; Max-Age=600; Path=/api/auth/github/callback; HttpOnly; SameSite=Lax${secure}`
  );

  res.redirect(302, authorizationUrl.toString());
}