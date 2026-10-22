import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Editor } from '@/editor/Editor';
import type { InitialProject } from '@/editor/store';
import { api, ApiError } from '@/lib/api';

export const Route = createFileRoute('/p/$projectId')({
  validateSearch: z.object({
    level: z.string().optional(),
    mode: z.enum(['2d', '3d']).optional(),
    focus: z.string().optional(),
    v: z.coerce.number().int().positive().optional(),
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const q = useQuery({ queryKey: ['project', projectId], queryFn: () => api<InitialProject>(`/projects/${projectId}`), staleTime: Infinity, gcTime: 0 });
  if (q.isLoading) {
    return (
      <div className="flex h-dvh flex-col">
        <div className="h-12 border-b" />
        <div className="flex flex-1"><Skeleton className="m-4 flex-1" /><div className="w-[380px] border-l max-md:hidden" /></div>
      </div>
    );
  }
  if (q.error || !q.data) {
    const status = q.error instanceof ApiError ? q.error.status : 0;
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-lg font-medium">{status === 401 ? '请先登录' : '打不开这个方案'}</p>
        <p className="text-sm text-muted-foreground">{q.error?.message}</p>
        <div className="flex gap-2">
          {status === 401 ? <Button nativeButton={false} render={<Link to="/login" search={{ redirect: `/p/${projectId}` }} />}>登录</Button> : <Button nativeButton={false} render={<Link to="/projects" />}>回到我的方案</Button>}
        </div>
      </div>
    );
  }
  return <Editor initial={q.data} search={search} />;
}
