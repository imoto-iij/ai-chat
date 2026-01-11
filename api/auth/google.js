import {
  verifyGoogleToken,
  isEmailAllowed,
  createToken,
  setAuthCookie,
} from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: "Credential required" });
  }

  try {
    const payload = await verifyGoogleToken(credential);

    // 許可されたメールアドレスかチェック
    if (!isEmailAllowed(payload.email)) {
      return res.status(403).json({
        error: "Access denied",
        message: "このメールアドレスはアクセスが許可されていません",
      });
    }

    // JWTトークンを生成
    const token = createToken({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });

    // Cookieにトークンを設定
    setAuthCookie(res, token);

    res.json({
      success: true,
      user: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({ error: "Invalid Google credential" });
  }
}
