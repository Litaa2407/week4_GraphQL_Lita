const { timingSafeEqual } = require("crypto");
const { sessionCookie, signAppToken } = require("../../../../lib/auth");

const STATE_COOKIE = "github_oauth_state";

function clearStateCookie(isProduction) {
  const secure = isProduction ? "; Secure" : "";
  return `${STATE_COOKIE}=; Max-Age=0; Path=/api/auth/github/callback; HttpOnly; SameSite=Lax${secure}`;
}

export default async function githubCallback(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).end("Method not allowed");
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const cookies = [clearStateCookie(isProduction)];
  res.setHeader("Set-Cookie", cookies);

  const { code, state, error } = req.query;
  const expectedState = req.cookies[STATE_COOKIE];

  if (error || typeof code !== "string" || typeof state !== "string" || !expectedState) {
    res.status(400).json({ error: "GitHub authorization was not completed" });
    return;
  }

  const providedStateBuffer = Buffer.from(state);
  const expectedStateBuffer = Buffer.from(expectedState);

  if (
    providedStateBuffer.length !== expectedStateBuffer.length ||
    !timingSafeEqual(providedStateBuffer, expectedStateBuffer)
  ) {
    res.status(400).json({ error: "Invalid OAuth state" });
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret || !appUrl || !process.env.JWT_SECRET) {
    res.status(500).json({ error: "OAuth server configuration is incomplete" });
    return;
  }

  const callbackUri = `${appUrl.replace(/\/$/, "")}/api/auth/github/callback`;

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUri,
      }),
    });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error("GitHub token exchange failed");
    }

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${tokenData.access_token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!profileResponse.ok) {
      throw new Error("GitHub profile request failed");
    }

    const profile = await profileResponse.json();
    const appToken = signAppToken(profile);

    cookies.push(sessionCookie(appToken, isProduction));
    res.setHeader("Set-Cookie", cookies);
    res.redirect(302, `${appUrl.replace(/\/$/, "")}/`);
  } catch (callbackError) {
    console.error("GitHub OAuth callback failed:", callbackError.message);
    res.status(502).json({ error: "Could not complete GitHub sign-in" });
  }
}