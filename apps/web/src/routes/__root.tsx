/// <reference types="vite/client" />
import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query';
import css from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'color-scheme', content: 'light dark' },
      { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#171717', media: '(prefers-color-scheme: dark)' },
      { title: 'Plinth · 说话就能改的房屋方案' },
      { name: 'description', content: '内置 agent 的房屋方案设计：你提需求、做决定，agent 画方案、算面积、自己检查。' },
    ],
    links: [
      { rel: 'stylesheet', href: css },
      { rel: 'icon', href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="4" y="18" width="24" height="10" fill="%23171717"/><rect x="9" y="6" width="14" height="12" fill="none" stroke="%23171717" stroke-width="2.5"/></svg>' },
    ],
  }),
  shellComponent: Shell,
  component: () => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <Toaster position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  ),
});

function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
