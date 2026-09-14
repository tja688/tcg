import { ensureServer, pingQwen } from './serve.mjs';
import { QWEN } from './config.mjs';

export function qwenLocalPlugin() {
  return {
    name: 'qwen-local-sidecar',
    async configureServer() {
      try {
        if (await pingQwen()) {
          console.log(`[qwen] sidecar already up on :${QWEN.port}`);
          return;
        }
        await ensureServer();
        console.log(`[qwen] sidecar listening on :${QWEN.port}`);
      } catch (err) {
        console.warn(`[qwen] sidecar not started: ${err.message}`);
        console.warn('[qwen] 对话会走内置兜底台词，打牌逻辑不受影响。可先执行 npm run qwen:setup');
      }
    },
  };
}
