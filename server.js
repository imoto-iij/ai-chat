import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

const SYSTEM_PROMPT = `あなたは親切で知識豊富なAIアシスタントです。
ユーザーの質問に対して、わかりやすく丁寧に回答してください。
日本語で回答し、必要に応じてコード例や具体例を提示してください。`;

// JSONボディのパース
app.use(express.json());

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, "public")));

// チャットAPI エンドポイント
app.post("/api/chat", async (req, res) => {
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
});
