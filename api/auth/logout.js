import { clearAuthCookie } from "../lib/auth.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  clearAuthCookie(res);
  res.json({ success: true });
}
