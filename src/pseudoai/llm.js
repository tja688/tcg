const CANDIDATES = [
  { health: '/qwen/health', chat: '/qwen/v1/chat/completions' },
  { health: 'http://127.0.0.1:8721/health', chat: 'http://127.0.0.1:8721/v1/chat/completions' },
];

const THINK_RE = /<think>[\s\S]*?<\/think>/gi;
const SPEAKER_RE = /^(?:敌人|敌方|你|我|角色|旁白)[:：]\s*/;
const STRIP_QUOTES = /^[「『"“'`]+|[」』"”'`]+$/g;

let _ok = null;
let _chatUrl = null;
let _inflight = 0;

export function llmStatus() {
  return { ok: _ok, inflight: _inflight, url: _chatUrl };
}

async function fetchText(url, timeoutMs, init) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    const text = await res.text();
    return { res, text };
  } finally {
    clearTimeout(t);
  }
}

function looksReady(text) {
  return /status["']?\s*:\s*["']ok["']/i.test(text) || text.includes('"ok"');
}

export async function probeLlm(timeoutMs = 700) {
  for (const c of CANDIDATES) {
    try {
      const { res, text } = await fetchText(c.health, timeoutMs);
      if (res.ok && looksReady(text)) {
        _chatUrl = c.chat;
        _ok = true;
        return true;
      }
    } catch {
      /* try next */
    }
  }
  _ok = false;
  _chatUrl = null;
  return false;
}

export function sanitizeLine(raw, maxLen = 28) {
  if (!raw) return '';
  let s = String(raw).replace(THINK_RE, '').replace(/\r/g, '');
  s = s.split('\n').map((l) => l.trim()).find(Boolean) || '';
  s = s.replace(SPEAKER_RE, '').replace(STRIP_QUOTES, '').trim();
  s = s.replace(/[\s。！？!?]{2,}/g, (m) => m[0]);
  if (/建议|应该出|推荐|最优|策略|分析|作为AI|语言模型|Thinking Process/.test(s)) return '';
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/[，,、；;：:\s]+$/, '');
  return s;
}

export async function mutterOnce({ system, user, maxTokens = 40, timeoutMs = 2200 }) {
  if (!_chatUrl) await probeLlm(700);
  const urls = _chatUrl ? [_chatUrl] : CANDIDATES.map((c) => c.chat);
  const body = JSON.stringify({
    model: 'Qwen3.5-2B',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.95,
    top_p: 0.9,
    max_tokens: maxTokens,
    stream: false,
    chat_template_kwargs: { enable_thinking: false },
  });
  _inflight += 1;
  try {
    let lastErr = null;
    for (const url of urls) {
      try {
        const { res, text } = await fetchText(url, timeoutMs, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (!res.ok) throw new Error(`http ${res.status}`);
        const data = JSON.parse(text);
        const msg = data?.choices?.[0]?.message || {};
        const line = sanitizeLine(msg.content || msg.reasoning_content || '');
        if (line) {
          _chatUrl = url;
          _ok = true;
          return line;
        }
      } catch (err) {
        lastErr = err;
      }
    }
    _ok = false;
    if (lastErr) throw lastErr;
    return '';
  } finally {
    _inflight -= 1;
  }
}
