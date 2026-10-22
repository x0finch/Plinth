import { migrate } from '@plinth/core';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowRightIcon, CheckIcon, LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import sampleJson from '../../../../samples/wushi-10/project.json';
import { PlanPreview } from '@/components/site/PlanPreview';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/query';
import { startTrial } from '@/lib/trial';

export const Route = createFileRoute('/')({ component: Landing });

const sample = migrate(sampleJson);

const STEPS = [
  { t: '说出需求', d: '家里几口人、要几间房、偏好什么。也可以在图上点一面墙，说“这面墙往东挪半米”。' },
  { t: 'agent 画方案、自己检查', d: '它直接改方案数据：墙、门窗、房间、家具。改完自检房间重叠、门开向、面积，再把改动指给你看。' },
  { t: '和家人一起定', d: '一个链接发给家人，能看平面和三维、在墙上评论。每一版都留着，随时回退。' },
];

const POINTS = [
  '每间多大、改前改后差多少，自动算',
  '“门在房间中间”“老人房约 12 平”这类要求会被记住，之后改别处也保持',
  '结构、消防相关的改动会标注“需专业人员复核”，不替你拍板',
  '大模型用你自己的密钥，支持 Claude、GPT、Gemini、通过 OpenRouter 用国内模型',
];

function Landing() {
  const me = useMe();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (t: 'sample' | 'blank') => {
    setBusy(t);
    try {
      const id = await startTrial(t);
      await navigate({ to: '/p/$projectId', params: { projectId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '出错了');
      setBusy(null);
    }
  };
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        <section className="grid items-center gap-10 py-12 md:grid-cols-[1fr_1.1fr] md:py-20">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">说话就能改的房屋方案</h1>
            <p className="mt-4 text-muted-foreground text-pretty">
              你提需求、做决定；内置的 agent 是方案的作者：画墙开窗、排房间、算面积、自己检查。不用懂坐标、墙厚或软件操作。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="lg" onClick={() => go('sample')} disabled={!!busy}>
                {busy === 'sample' ? <LoaderIcon className="animate-spin" /> : null}打开样例方案试试 <ArrowRightIcon />
              </Button>
              <Button size="lg" variant="outline" onClick={() => go('blank')} disabled={!!busy}>
                {busy === 'blank' ? <LoaderIcon className="animate-spin" /> : null}从零开始
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              无需注册即可试用。{me.data?.user && !me.data.user.isAnonymous ? <Link to="/projects" className="underline">进入我的方案</Link> : <><Link to="/login" className="underline">登录</Link>后方案会一直保存在你的账号里。</>}
            </p>
          </div>
          <figure className="rounded-xl border bg-[var(--plan-bg)] p-3">
            <PlanPreview project={sample} className="w-full" />
            <figcaption className="px-1 pt-2 text-xs text-muted-foreground">样例：乌石合院一层，房间面积由方案数据实时算出</figcaption>
          </figure>
        </section>

        <section className="grid gap-6 border-t py-12 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.t}>
              <p className="font-mono text-xs text-muted-foreground">0{i + 1}</p>
              <h2 className="mt-1 font-medium">{s.t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </section>

        <section className="border-t py-12">
          <ul className="grid gap-3 md:grid-cols-2">
            {POINTS.map(p => (
              <li key={p} className="flex gap-2 text-sm"><CheckIcon className="mt-0.5 size-4 shrink-0" />{p}</li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
