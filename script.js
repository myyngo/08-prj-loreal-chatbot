/* ============================================================
   L'Oréal Smart Routine & Product Advisor — script.js

   Captures user input, maintains conversation history, and
   calls the Cloudflare Worker proxy which forwards requests
   to the OpenAI Chat Completions API.
   ============================================================ */

// ── Configuration ────────────────────────────────────────────
// Replace this with your deployed Cloudflare Worker URL.
// Example: 'https://loreal-chatbot.your-subdomain.workers.dev'
const WORKER_URL = 'https://lorealworker.mnngo.workers.dev/';

// ── System Prompt ─────────────────────────────────────────────
// Instructs the AI to act exclusively as an L'Oréal beauty advisor
// and politely refuse questions outside that scope.
const SYSTEM_PROMPT = `You are an expert L'Oréal Smart Routine & Product Advisor — \
a knowledgeable, warm, and enthusiastic beauty consultant representing the L'Oréal Group.

Your role is to help customers:
• Discover the right L'Oréal products for their skin type, tone, hair type, and beauty goals
• Build personalised morning and evening skincare routines
• Learn how to correctly layer skincare products (order of application, waiting times)
• Get makeup tips, colour-matching advice, and application techniques
• Understand haircare regimens — from scalp health to colour protection and heat styling
• Learn about key active ingredients: retinol, hyaluronic acid, niacinamide, vitamin C,
  ceramides, glycolic acid, SPF, and how they benefit different skin concerns

L'Oréal brands and product lines you should reference (not exhaustive):
Skincare — Revitalift (anti-ageing), Age Perfect (mature skin), Pure Clay (deep clean),
  Bright Reveal (vitamin C), Hydra Genius (hydration), Bright Skin (dark spots)
Foundation & Complexion — True Match, Infallible Fresh Wear, Accord Parfait
Eyes & Lips — Voluminous, Telescopic, Colour Riche, Infallible Lip, Paradise Mascara
Haircare — Elvive (EverPure, Total Repair, Dream Lengths, Colour Protect, Extraordinary Oil),
  Casting Crème Gloss, Excellence Crème, Botanicals Fresh Care
Men — Men Expert Hydra Energetic, Barber Club, Vita Lift

When a customer's skin or hair type is unclear, ask one short clarifying question before recommending.
Keep responses friendly, professional, and concise — typically 3–6 sentences unless a
detailed routine is explicitly requested. Use bullet points or numbered steps for routines.

IMPORTANT — Topic scope:
You ONLY answer questions related to L'Oréal products, beauty routines, skincare, haircare,
makeup, fragrance, personal care, and beauty ingredient science. If a user asks about anything
outside this scope — cooking, sports, politics, finance, coding, etc. — respond with exactly:
"I'm here exclusively for all things L'Oréal beauty! I'm not able to help with that topic, \
but I'd love to assist you with skincare routines, product recommendations, or beauty tips. \
What beauty question can I answer for you today?"`;

// ── Conversation history ──────────────────────────────────────
// The system message anchors every API call; user/assistant turns
// are appended as the conversation progresses.
const conversationHistory = [
  { role: 'system', content: SYSTEM_PROMPT }
];

// ── DOM references ────────────────────────────────────────────
const chatWindow         = document.getElementById('chat-window');
const mainScroll         = document.getElementById('main-scroll');
const userInput          = document.getElementById('user-input');
const sendBtn            = document.getElementById('send-btn');
const typingIndicator    = document.getElementById('typing-indicator');
const userQuestionBanner = document.getElementById('user-question-display');
const userQuestionText   = document.getElementById('user-question-text');

// ── Helpers ───────────────────────────────────────────────────

/**
 * Escape HTML special characters and convert Markdown-like
 * **bold** and newlines into safe HTML for display.
 */
function formatText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

/**
 * Create and append a chat message bubble to the chat window.
 * @param {'user'|'assistant'} role
 * @param {string} text  Plain text (will be safely HTML-encoded)
 */
function appendMessage(role, text) {
  const isUser = role === 'user';

  // Outer row (flex container, reversed for user messages)
  const row = document.createElement('div');
  row.className = 'message' + (isUser ? ' user-message' : '');

  // Avatar circle
  const avatar = document.createElement('div');
  avatar.className = 'avatar ' + (isUser ? 'user-avatar' : 'assistant-avatar');
  avatar.textContent = isUser ? 'Y' : 'L';

  // Message bubble
  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (isUser ? 'user-bubble' : 'assistant-bubble');
  bubble.innerHTML = '<p>' + formatText(text) + '</p>';

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatWindow.appendChild(row);

  scrollToBottom();
}

/** Scroll the chat area to show the latest message. */
function scrollToBottom() {
  mainScroll.scrollTop = mainScroll.scrollHeight;
}

/**
 * Enable or disable the loading state (typing indicator + send button).
 * @param {boolean} loading
 */
function setLoading(loading) {
  sendBtn.disabled = loading;
  typingIndicator.classList.toggle('hidden', !loading);
  if (loading) scrollToBottom();
}

// ── Core: send a message ──────────────────────────────────────

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || sendBtn.disabled) return;

  // Clear input and show user's message immediately
  userInput.value = '';
  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  // Update the "You: …" banner above the chat window (resets each turn)
  userQuestionText.textContent = text;
  userQuestionBanner.classList.remove('hidden');

  setLoading(true);

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    if (!response.ok) {
      throw new Error(`Worker returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Unknown API error');
    }

    const reply = data.choices[0].message.content;
    conversationHistory.push({ role: 'assistant', content: reply });
    appendMessage('assistant', reply);

  } catch (err) {
    console.error('Chat error:', err);
    appendMessage(
      'assistant',
      "I'm sorry, I'm having trouble connecting right now. " +
      "Please ensure the Cloudflare Worker URL is set in script.js and try again."
    );
  } finally {
    setLoading(false);
    userInput.focus();
  }
}

// ── Event listeners ───────────────────────────────────────────

sendBtn.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', (e) => {
  // Send on Enter (but not Shift+Enter which could be used for newlines)
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ── Initial greeting ──────────────────────────────────────────

appendMessage(
  'assistant',
  "Welcome to L'Oréal's Smart Routine & Product Advisor! ✨\n\n" +
  "I'm here to help you discover the perfect products and build a personalised beauty routine. " +
  "Whether you're looking for skincare advice, makeup recommendations, or haircare tips — I've got you covered.\n\n" +
  "What can I help you with today?"
);

userInput.focus();
