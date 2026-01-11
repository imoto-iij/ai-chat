import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `あなたは親切で知識豊富なAIアシスタントです。
ユーザーの質問に対して、わかりやすく丁寧に回答してください。
日本語で回答し、必要に応じてコード例や具体例を提示してください。`;

export default async function handler(req, res) {
  // CORSヘッダー設定
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // POSTリクエストのみ許可
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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
      history: history.slice(-20), // 直近20メッセージに制限
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

    // ストリーミング中のエラー
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({ type: "error", message: error.message || "An error occurred" })}\n\n`
      );
      res.end();
    } else {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
}
