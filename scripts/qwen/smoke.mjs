import { serverUrl } from './config.mjs';
import { pingQwen } from './serve.mjs';

const ok = await pingQwen(1500);
if (!ok) {
  console.error('[qwen] server not ready');
  process.exit(2);
}

const res = await fetch(`${serverUrl()}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'Qwen3.5-2B',
    messages: [
      { role: 'system', content: '你是深渊魔王。只呢喃一句不超过12字，不要引号。' },
      { role: 'user', content: '对手刚打出烈焰火球。呢喃一句。' },
    ],
    max_tokens: 32,
    temperature: 0.9,
    chat_template_kwargs: { enable_thinking: false },
  }),
});
const data = await res.json();
const line = data?.choices?.[0]?.message?.content || '';
console.log('[qwen] smoke:', JSON.stringify(line));
if (!line) process.exit(1);
