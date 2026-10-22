import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * 前端：TanStack Router 单页应用，构建成静态资源。
 * 服务端：Worker 里只有 Hono（/api/*），不带 React，体积和冷启动都小，适合免费版的 3 MB / 10 ms 限制。
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 3000 },
  build: { sourcemap: false },
  // Worker 环境（名字同 wrangler.jsonc 的 name）也压缩：冷启动解析更快
  environments: { plinth: { build: { minify: true } } },
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), viteReact(), tailwindcss(), cloudflare()],
});
