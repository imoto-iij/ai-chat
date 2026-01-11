import { isAuthEnabled, checkAuth } from "../lib/auth.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authEnabled = isAuthEnabled();

  if (!authEnabled) {
    return res.json({ authenticated: true, authEnabled: false });
  }

  const { authenticated, user } = checkAuth(req);

  return res.json({
    authenticated,
    authEnabled: true,
    user: authenticated ? user : undefined,
  });
}
