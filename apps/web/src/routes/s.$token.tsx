import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { api, ROLE_ZH, type Role } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { queryClient, useMe } from '@/lib/query';

export const Route = createFileRoute('/s/$token')({ component: AcceptShare });

function AcceptShare() {
  const { token } = Route.useParams();
  const me = useMe();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = useQuery({ queryKey: ['share', token], queryFn: () => api<{ projectId: string; name: string; role: Role }>(`/share/${token}`), retry: false });

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!me.data?.user) {
        const r = await authClient.signIn.anonymous();
        if (r.error) throw new Error(r.error.message ?? '无法进入');
        await queryClient.invalidateQueries({ queryKey: ['me'] });
      }
      const r = await api<{ projectId: string }>(`/share/${token}/accept`, { method: 'POST' });
      await navigate({ to: '/p/$projectId', params: { projectId: r.projectId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '出错了');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div className="flex justify-center"><Logo /></div>
        {link.isLoading ? (
          <LoaderIcon className="mx-auto animate-spin" />
        ) : link.error ? (
          <p className="text-muted-foreground">这个分享链接已失效，请向方案主人要一个新的。</p>
        ) : (
          <>
            <div>
              <p className="text-sm text-muted-foreground">有人和你分享了一个房屋方案</p>
              <h1 className="mt-1 text-xl font-semibold">{link.data!.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">你的权限：{ROLE_ZH[link.data!.role]}</p>
            </div>
            <Button className="w-full" onClick={accept} disabled={busy}>{busy && <LoaderIcon className="animate-spin" />}打开方案</Button>
            {!me.data?.user && <p className="text-xs text-muted-foreground">不用注册就能看。想在换设备时也能找到它，可以之后再登录。</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
