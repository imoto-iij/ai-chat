# AI Chat - プロジェクト仕様書

## プロジェクト概要

汎用AIアシスタントチャットボットアプリケーション。Google Gemini APIを使用し、一般ユーザー向けに幅広い質問に対応する。

## 技術スタック

### フロントエンド
- **構成:** シンプルHTML/CSS/JavaScript（フレームワークなし）
- **スタイリング:** CSS（Vanilla CSS）

### バックエンド
- **ランタイム:** Node.js
- **フレームワーク:** Express.js
- **API:** RESTful API + Server-Sent Events (SSE) for streaming

### AI
- **プロバイダー:** Google Gemini API
- **モデル:** gemini-2.5-flash
- **無料枠:** 1分あたり15リクエスト、1日1500リクエスト

### デプロイ
- **プラットフォーム:** Vercel
- **フロントエンド:** Vercel Static Hosting
- **バックエンド:** Vercel Serverless Functions

## 機能要件

### 必須機能
1. **チャット機能**
   - ユーザーがメッセージを入力してAIと対話できる
   - ストリーミングレスポンス（リアルタイムで文字が流れる）

2. **会話履歴**
   - localStorageを使用してブラウザに保存
   - 複数の会話スレッドを管理
   - 会話の作成・削除・切り替え

3. **UI/UX**
   - ChatGPT風のレイアウト（サイドバー + メインチャット）
   - レスポンシブデザイン（モバイル対応）
   - ダークモード/ライトモードは初期実装では不要

### 認証
- 認証機能なし（誰でもアクセス可能）

## ディレクトリ構成

```
ai-chat/
├── public/                  # 静的ファイル
│   ├── index.html          # メインHTML
│   ├── styles.css          # スタイルシート
│   └── script.js           # フロントエンドJS
├── api/                     # Vercel Serverless Functions
│   └── chat.js             # チャットAPI エンドポイント
├── package.json            # 依存関係
├── vercel.json             # Vercel設定
├── .env.example            # 環境変数サンプル
├── .gitignore              # Git除外設定
└── CLAUDE.md               # このファイル
```

## API設計

### POST /api/chat
チャットメッセージを送信し、ストリーミングレスポンスを受け取る。

**リクエスト:**
```json
{
  "messages": [
    {"role": "user", "content": "こんにちは"},
    {"role": "assistant", "content": "こんにちは！何かお手伝いできることはありますか？"},
    {"role": "user", "content": "今日の天気は？"}
  ]
}
```

**レスポンス:** Server-Sent Events (SSE) ストリーム
```
data: {"type": "delta", "text": "申し"}
data: {"type": "delta", "text": "訳あり"}
...
data: {"type": "done"}
```

## 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `GOOGLE_API_KEY` | Google AI APIキー | Yes |

APIキーは https://aistudio.google.com/app/apikey から無料で取得できます。

## システムプロンプト

```
あなたは親切で知識豊富なAIアシスタントです。
ユーザーの質問に対して、わかりやすく丁寧に回答してください。
日本語で回答し、必要に応じてコード例や具体例を提示してください。
```

## UI仕様

### レイアウト
- **サイドバー（左）**
  - 新規チャットボタン
  - 会話履歴リスト
  - 各会話の削除ボタン

- **メインエリア（右）**
  - チャットメッセージ表示エリア（スクロール可能）
  - メッセージ入力フォーム（下部固定）
  - 送信ボタン

### デザイン
- クリーンでモダンなデザイン
- 配色: 白/グレーベース
- フォント: システムフォント（sans-serif）

## 開発コマンド

```bash
# 依存関係インストール
npm install

# ローカル開発サーバー起動
npm run dev

# Vercelへデプロイ
vercel --prod
```

## 実装上の注意点

1. **APIキーの保護**
   - APIキーはサーバーサイドでのみ使用
   - フロントエンドにAPIキーを露出させない

2. **エラーハンドリング**
   - API呼び出し失敗時の適切なエラーメッセージ表示
   - ネットワークエラー時のリトライ機能は初期実装では不要

3. **ストリーミング**
   - SSE (Server-Sent Events) を使用
   - 接続切断時の適切なハンドリング

4. **会話コンテキスト**
   - 直近の会話履歴をAPIに送信（最大20メッセージ程度）
   - トークン制限を考慮

## 今後の拡張候補（初期実装には含めない）

- ダークモード
- Markdown/コードブロックの整形表示
- 会話のエクスポート機能
- 複数のAIモデル切り替え
- 音声入力対応
