import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// 環境変数
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false"; // デフォルトで認証有効

const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID);

const SYSTEM_PROMPT = `あなたは親切で知識豊富なAIアシスタントです。
ユーザーの質問に対して、わかりやすく丁寧に回答してください。
日本語で回答し、必要に応じてコード例や具体例を提示してください。`;

// ミドルウェア
app.use(express.json());
app.use(cookieParser());

// 認証ミドルウェア
const authMiddleware = async (req, res, next) => {
  // 認証が無効の場合はスキップ
  if (!AUTH_ENABLED) {
    return next();
  }

  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// 認証状態確認API
app.get("/api/auth/status", (req, res) => {
  if (!AUTH_ENABLED) {
    return res.json({ authenticated: true, authEnabled: false });
  }

  const token = req.cookies.auth_token;

  if (!token) {
    return res.json({ authenticated: false, authEnabled: true });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({
      authenticated: true,
      authEnabled: true,
      user: {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      },
    });
  } catch (error) {
    return res.json({ authenticated: false, authEnabled: true });
  }
});

// Google OAuth設定取得API
app.get("/api/auth/config", (req, res) => {
  res.json({
    clientId: GOOGLE_CLIENT_ID,
    authEnabled: AUTH_ENABLED,
  });
});

// Google認証API
app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: "Credential required" });
  }

  try {
    // Googleトークンを検証
    const ticket = await oauth2Client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // JWTトークンを生成
    const token = jwt.sign(
      {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Cookieにトークンを設定
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7日
    });

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
});

// ログアウトAPI
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("auth_token");
  res.json({ success: true });
});

// 静的ファイルの配信（認証不要のファイル）
app.use(express.static(path.join(__dirname, "public")));

// チャットAPI エンドポイント（認証必要）
app.post("/api/chat", authMiddleware, async (req, res) => {
  // CORSヘッダー設定
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // APIキーの確認
  if (!process.env.GOOGLE_API_KEY) {
    console.error("GOOGLE_API_KEY is not set");
    res.status(500).json({ error: "API key not configured" });
    return;
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Invalid messages format" });
      return;
    }

    // Google AI クライアントを初期化
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    // SSE用のヘッダー設定
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Gemini モデルを初期化
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    // メッセージ履歴をGemini形式に変換
    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // 最新のユーザーメッセージを取得
    const lastMessage = messages[messages.length - 1];

    // チャットセッションを開始
    const chat = model.startChat({
      history: history.slice(-20),
    });

    // ストリーミングでレスポンスを生成
    const result = await chat.sendMessageStream(lastMessage.content);

    // ストリーミングレスポンスを送信
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        const data = JSON.stringify({
          type: "delta",
          text: text,
        });
        res.write(`data: ${data}\n\n`);
      }
    }

    // ストリーム終了を通知
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error) {
    console.error("API Error:", error.message || error);

    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({ type: "error", message: error.message || "An error occurred" })}\n\n`
      );
      res.end();
    } else {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
});

// OPTIONSリクエスト対応
app.options("/api/chat", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(200).end();
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Authentication: ${AUTH_ENABLED ? "enabled" : "disabled"}`);
});
