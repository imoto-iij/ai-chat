// DOM要素の取得
const chatList = document.getElementById("chatList");
const chatContainer = document.getElementById("chatContainer");
const messagesContainer = document.getElementById("messages");
const welcomeMessage = document.getElementById("welcomeMessage");
const inputForm = document.getElementById("inputForm");
const inputField = document.getElementById("inputField");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".sidebar");

// 状態管理
let conversations = [];
let currentConversationId = null;
let isGenerating = false;

// ローカルストレージのキー
const STORAGE_KEY = "ai-chat-conversations";

// 初期化
function init() {
  loadConversations();
  renderChatList();
  setupEventListeners();
  autoResizeTextarea();
}

// イベントリスナーの設定
function setupEventListeners() {
  inputForm.addEventListener("submit", handleSubmit);
  newChatBtn.addEventListener("click", createNewConversation);
  sidebarToggle.addEventListener("click", toggleSidebar);

  // テキストエリアの自動リサイズ
  inputField.addEventListener("input", autoResizeTextarea);

  // Enterキーで送信（Shift+Enterで改行）
  inputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  });

  // サイドバー外クリックで閉じる（モバイル）
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      e.target !== sidebarToggle
    ) {
      sidebar.classList.remove("open");
    }
  });
}

// テキストエリアの自動リサイズ
function autoResizeTextarea() {
  inputField.style.height = "auto";
  inputField.style.height = Math.min(inputField.scrollHeight, 200) + "px";
}

// サイドバーの表示切り替え
function toggleSidebar() {
  sidebar.classList.toggle("open");
}

// 会話の読み込み
function loadConversations() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    conversations = JSON.parse(saved);
    if (conversations.length > 0) {
      currentConversationId = conversations[0].id;
    }
  }
}

// 会話の保存
function saveConversations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

// 新しい会話の作成
function createNewConversation() {
  const newConversation = {
    id: Date.now().toString(),
    title: "新しいチャット",
    messages: [],
    createdAt: new Date().toISOString(),
  };

  conversations.unshift(newConversation);
  currentConversationId = newConversation.id;
  saveConversations();
  renderChatList();
  renderMessages();

  // モバイルでサイドバーを閉じる
  if (window.innerWidth <= 768) {
    sidebar.classList.remove("open");
  }
}

// 会話の削除
function deleteConversation(id, e) {
  e.stopPropagation();

  conversations = conversations.filter((c) => c.id !== id);

  if (currentConversationId === id) {
    currentConversationId =
      conversations.length > 0 ? conversations[0].id : null;
  }

  saveConversations();
  renderChatList();
  renderMessages();
}

// 会話の選択
function selectConversation(id) {
  currentConversationId = id;
  renderChatList();
  renderMessages();

  // モバイルでサイドバーを閉じる
  if (window.innerWidth <= 768) {
    sidebar.classList.remove("open");
  }
}

// チャットリストのレンダリング
function renderChatList() {
  chatList.innerHTML = conversations
    .map(
      (conv) => `
    <div class="chat-item ${conv.id === currentConversationId ? "active" : ""}"
         onclick="selectConversation('${conv.id}')">
      <span class="chat-item-title">${escapeHtml(conv.title)}</span>
      <button class="chat-item-delete" onclick="deleteConversation('${conv.id}', event)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    </div>
  `
    )
    .join("");
}

// メッセージのレンダリング
function renderMessages() {
  const conversation = conversations.find(
    (c) => c.id === currentConversationId
  );

  if (!conversation || conversation.messages.length === 0) {
    welcomeMessage.classList.remove("hidden");
    messagesContainer.innerHTML = "";
    return;
  }

  welcomeMessage.classList.add("hidden");
  messagesContainer.innerHTML = conversation.messages
    .map(
      (msg) => `
    <div class="message ${msg.role}">
      <div class="message-role">${msg.role === "user" ? "あなた" : "AI"}</div>
      <div class="message-content">${escapeHtml(msg.content)}</div>
    </div>
  `
    )
    .join("");

  scrollToBottom();
}

// メッセージの追加
function addMessage(role, content) {
  const conversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  if (!conversation) return;

  conversation.messages.push({ role, content });

  // 最初のユーザーメッセージでタイトルを更新
  if (role === "user" && conversation.messages.length === 1) {
    conversation.title = content.slice(0, 30) + (content.length > 30 ? "..." : "");
    renderChatList();
  }

  saveConversations();
}

// メッセージの更新（ストリーミング用）
function updateLastAssistantMessage(content) {
  const conversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  if (!conversation) return;

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  if (lastMessage && lastMessage.role === "assistant") {
    lastMessage.content = content;
    saveConversations();
  }
}

// フォーム送信処理
async function handleSubmit(e) {
  e.preventDefault();

  const message = inputField.value.trim();
  if (!message || isGenerating) return;

  // 新しい会話を作成（必要な場合）
  if (!currentConversationId) {
    createNewConversation();
  }

  // ユーザーメッセージを追加
  addMessage("user", message);
  renderMessages();

  // 入力フィールドをクリア
  inputField.value = "";
  autoResizeTextarea();

  // 送信ボタンを無効化
  isGenerating = true;
  sendBtn.disabled = true;

  // アシスタントメッセージのプレースホルダーを追加
  addMessage("assistant", "");

  // タイピングインジケーターを表示
  const assistantMessageEl = createAssistantMessageElement();
  messagesContainer.appendChild(assistantMessageEl);
  scrollToBottom();

  try {
    // APIを呼び出し
    const conversation = conversations.find(
      (c) => c.id === currentConversationId
    );
    const messagesToSend = conversation.messages
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    await streamResponse(messagesToSend, assistantMessageEl);
  } catch (error) {
    console.error("Error:", error);
    updateLastAssistantMessage("エラーが発生しました。もう一度お試しください。");
    renderMessages();
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
  }
}

// アシスタントメッセージ要素の作成
function createAssistantMessageElement() {
  const div = document.createElement("div");
  div.className = "message assistant";
  div.innerHTML = `
    <div class="message-role">AI</div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  return div;
}

// ストリーミングレスポンスの処理
async function streamResponse(messages, messageEl) {
  const contentEl = messageEl.querySelector(".message-content");
  let fullContent = "";

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === "delta" && data.text) {
            fullContent += data.text;
            contentEl.textContent = fullContent;
            scrollToBottom();
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        } catch (e) {
          // JSONパースエラーは無視
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  }

  // 最終的なコンテンツを保存
  updateLastAssistantMessage(fullContent);
}

// スクロールを一番下に
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// グローバル関数として公開
window.selectConversation = selectConversation;
window.deleteConversation = deleteConversation;

// アプリケーションの初期化
init();
