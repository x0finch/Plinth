import { Link, useNavigate } from '@tanstack/react-router';
import { LogOutIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';
import { queryClient, useMe } from '@/lib/query';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-medium tracking-tight">
      <svg viewBox="0 0 32 32" className="size-5" aria-hidden><rect x="4" y="18" width="24" height="10" fill="currentColor" /><rect x="9" y="6" width="14" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>
      Plinth
    </Link>
  );
}

export function SiteHeader() {
  const me = useMe();
  const navigate = useNavigate();
  const user = me.data?.user;
  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    void navigate({ to: '/' });
  };
  return (
    <header className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
      <Logo />
      <div className="flex-1" />
      {user ? (
        <>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/projects" />}>我的方案</Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="账号" />}><UserIcon /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal text-muted-foreground">{user.isAnonymous ? '访客（试用中）' : user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user.isAnonymous && <DropdownMenuItem render={<Link to="/login" />}><UserIcon /> 登录以保存方案</DropdownMenuItem>}
              <DropdownMenuItem render={<Link to="/settings" />}><SettingsIcon /> 设置</DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}><LogOutIcon /> 退出</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/login" />}>登录</Button>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-5xl flex-wrap gap-4 px-4 py-8 text-xs text-muted-foreground">
      <span>Plinth</span>
      <Link to="/privacy" className="hover:underline">隐私政策</Link>
      <Link to="/terms" className="hover:underline">使用条款</Link>
      <span className="flex-1" />
      <span>方案仅供参考；结构、消防、规范相关内容需专业人员复核。</span>
    </footer>
  );
}
