/* ============================================================
   L'Oréal Chatbot — worker.js  (Cloudflare Worker)

   This script acts as a secure proxy between the frontend and
   the OpenAI API, keeping your API key out of the browser.

   SETUP:
   1. Create a new Worker in the Cloudflare dashboard.
   2. Paste the contents of this file into the editor.
   3. Go to Settings > Variables > add a Secret called:
        OPENAI_API_KEY   (value = your OpenAI API key)
   4. Deploy. Copy the Worker URL and paste it into script.js
      as the value of WORKER_URL.
   ============================================================ */

export default {
  async fetch(request, env) {

    // ── CORS headers returned on every response ──────────────
    // In production, replace '*' with your actual frontend origin,
    // e.g. 'https://your-github-pages-site.github.io'
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // ── Handle CORS preflight (browser sends OPTIONS first) ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── Only accept POST ─────────────────────────────────────
    if (request.method !== 'POST') {
      return jsonError(405, 'Method Not Allowed', corsHeaders);
    }

    // ── Parse request body ───────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, 'Invalid JSON in request body', corsHeaders);
    }

    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError(400, 'Request body must include a non-empty "messages" array', corsHeaders);
    }

    // ── Forward to OpenAI Chat Completions ───────────────────
    let openAIResponse;
    try {
      openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',

          messages: messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });
    } catch (err) {
      return jsonError(502, `Failed to reach OpenAI: ${err.message}`, corsHeaders);
    }

    // ── Relay the OpenAI response (success or API-level error) ─
    const data = await openAIResponse.json();

    return new Response(JSON.stringify(data), {
      status: openAIResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};

// ── Utility ──────────────────────────────────────────────────
function jsonError(status, message, corsHeaders) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
