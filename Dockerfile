FROM node:20-slim

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションコードをコピー
COPY . .

# ポート8080を公開
EXPOSE 8080

# アプリケーションを起動
CMD ["node", "server.js"]
