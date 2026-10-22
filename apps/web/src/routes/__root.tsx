import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query';

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <Toaster position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2">
      <p className="text-lg font-medium">页面不存在</p>
      <Link to="/" className="text-sm underline">回到首页</Link>
    </div>
  ),
});
