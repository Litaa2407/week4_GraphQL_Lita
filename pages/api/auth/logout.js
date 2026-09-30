const { sessionCookie } = require("../../../lib/auth");

export default function logout(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).end("Method not allowed");
    return;
  }

  res.setHeader("Set-Cookie", sessionCookie(null));
  res.status(204).end();
}