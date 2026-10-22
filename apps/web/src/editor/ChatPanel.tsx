/**
 * 和 agent 对话。能力清单里的每项能力都是浏览器端工具：agent 调用时在这里执行（走同一个事务和撤销），
 * 需要确认的操作弹出确认卡片。对话按人、按方案保存。
 */
import type { Project } from '@plinth/core';
import { toolDefinition } from '@tanstack/ai';
import { clientTools } from '@tanstack/ai-client';
import { fetchServerSentEvents, useChat, type UIMessage } from '@tanstack/ai-react';
import { Link } from '@tanstack/react-router';
import { ArrowUpIcon, CircleStopIcon, Columns2Icon, Undo2Icon, SparklesIcon, SettingsIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { registry } from '@/agent/registry';
import type { AgentContext } from '@/agent/prompt';
import { api, can, ROLE_ZH } from '@/lib/api';
import { AUTONOMY_ZH, getAutonomy, setAutonomy } from '@/lib/prefs';
import { needsApproval, type Autonomy } from '@/agent/policy';
import { useEditor, useEditorStore } from './store';

const SUGGESTIONS = ['这个方案一共多大？每层都有哪些房间？', '老人房一扩到 12 平方米', '在主卧北墙开一扇 1.5 米宽的窗', '帮我检查一下方案有没有问题'];
const SUGGESTIONS_BLANK = ['一家四口，两层，要三间卧室、一个书房，院子朝南', '帮我在 12×10 米的地上排一个一层的小院'];

/** 把一次能力调用说成一句话（确认卡片用） */
function describeCall(name: string, args: unknown, project: Project) {
  const c = registry.get(name);
  if (c?.mode === 'edit') {
    try {
      return c.label(c.input.parse(args), project);
    } catch {}
  }
  return `${c?.title ?? name}：${JSON.stringify(args)}`;
}

/** 去掉发给模型时没用的大字段（截图） */
function forModel(r: Awaited<ReturnType<typeof registry.call>>) {
  const res = r.result as any;
  if (res && typeof res === 'object' && typeof res.image === 'string') return { ...r, result: { ...res, image: '（已显示给业主）' } };
  return r;
}

type ToolState = 'input-streaming' | 'input-available' | 'approval-requested' | 'approval-responded' | 'output-available' | 'output-error' | 'output-denied';
function toolState(part: any, result: any): ToolState {
  if (result?.outcome === 'denied' || result?.outcome === 'cancelled') return 'output-denied';
  if (part.state === 'approval-requested') return 'approval-requested';
  if (result?.state === 'error' || part.state === 'error') return 'output-error';
  if (result || part.output !== undefined || part.state === 'complete') {
    const out = part.output ?? (typeof result?.content === 'string' ? safeJson(result.content) : null);
    return out && out.ok === false ? 'output-error' : 'output-available';
  }
  if (part.state === 'input-streaming' || part.state === 'awaiting-input') return 'input-streaming';
  return 'input-available';
}

const safeJson = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

function ChangeCard() {
  const last = useEditor(s => s.lastChange);
  const compare = useEditor(s => s.compare);
  const setCompare = useEditor(s => s.setCompare);
  const undo = useEditor(s => s.undo);
  if (!last) return null;
  const changes = last.areaChanges.filter(c => c.before != null && c.after != null && Math.abs(c.after - c.before) >= 0.05);
  const added = last.areaChanges.filter(c => c.before == null);
  const removed = last.areaChanges.filter(c => c.after == null);
  return (
    <div className="mx-3 mb-2 rounded-lg border bg-card p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{last.label}</span>
        <div className="flex gap-1">
          <Button size="xs" variant={compare ? 'secondary' : 'ghost'} onClick={() => setCompare(!compare)}>
            <Columns2Icon /> {compare ? '隐藏改前' : '对比改前'}
          </Button>
          <Button size="xs" variant="ghost" onClick={undo}>
            <Undo2Icon /> 撤销
          </Button>
        </div>
      </div>
      {(changes.length > 0 || added.length > 0 || removed.length > 0) && (
        <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
          {changes.map(c => (
            <li key={c.id}>
              {c.name}：{c.before!.toFixed(1)} → <span className="text-foreground">{c.after!.toFixed(1)} m²</span>（{c.after! > c.before! ? '+' : ''}{(c.after! - c.before!).toFixed(1)}）
            </li>
          ))}
          {added.map(c => <li key={c.id}>新增 {c.name}：{c.after!.toFixed(1)} m²</li>)}
          {removed.map(c => <li key={c.id}>去掉 {c.name}</li>)}
        </ul>
      )}
      {last.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
          {last.warnings.map((w, i) => <li key={i}>注意：{w.message}</li>)}
        </ul>
      )}
    </div>
  );
}

export function ChatPanel() {
  const store = useEditorStore();
  const projectId = useEditor(s => s.projectId);
  const role = useEditor(s => s.role);
  const model = useEditor(s => s.model);
  const project = useEditor(s => s.project);
  const view = useEditor(s => s.view);
  const readOnly = useEditor(s => s.readOnlyVersion != null);
  const [autonomy, setAuto] = useState<Autonomy>('balanced');
  const [input, setInput] = useState('');
  const [shots, setShots] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const editable = can(role, 'editor') && !readOnly;

  useEffect(() => setAuto(getAutonomy()), []);

  const tools = useMemo(
    () =>
      clientTools(
        ...registry.list().map(c =>
          toolDefinition({ name: c.name, description: c.title, inputSchema: c.input, needsApproval: needsApproval(c, autonomy) }).client(async (args: unknown) => {
            const r = await store.getState().call(c.name, args, { kind: 'agent' });
            const img = (r.result as any)?.image;
            if (typeof img === 'string') setShots(s => [...s, img]);
            return forModel(r);
          }),
        ),
      ),
    [store, autonomy],
  );

  const context = (): AgentContext => {
    const s = store.getState();
    const p = s.project;
    const typeOf = (id: string) => (p.walls.some(w => w.id === id) ? '墙' : p.spaces.some(x => x.id === id) ? '空间' : p.furniture.some(f => f.id === id) ? '家具' : '门窗');
    const nameOf = (id: string) => p.walls.find(w => w.id === id)?.name ?? p.spaces.find(x => x.id === id)?.name ?? p.furniture.find(f => f.id === id)?.name
      ?? p.walls.flatMap(w => w.openings).find(o => o.id === id)?.name ?? id;
    return {
      projectName: p.name,
      role: ROLE_ZH[s.role],
      view: { mode: s.view.mode, level: p.levels.find(l => l.id === s.view.level)?.name ?? s.view.level },
      selection: s.view.selection.map(id => ({ id, name: nameOf(id), type: typeOf(id) })),
      levels: p.levels.map(l => ({ id: l.id, name: l.name, spaces: p.spaces.filter(x => x.level === l.id).map(x => x.name) })),
      brief: p.brief,
      constraints: p.constraints.length,
    };
  };

  const { messages, sendMessage, isLoading, stop, error, interrupts, setMessages, status } = useChat({
    connection: fetchServerSentEvents(`/api/projects/${projectId}/chat`),
    tools,
    body: { autonomy },
  });

  // 读取历史对话
  useEffect(() => {
    api<UIMessage[]>(`/projects/${projectId}/chat-thread`)
      .then(m => Array.isArray(m) && m.length && setMessages(m as any))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [projectId]);

  // 一轮结束后保存对话
  const prevStatus = useRef(status);
  useEffect(() => {
    if (loaded && editable && prevStatus.current !== 'ready' && status === 'ready' && messages.length) {
      api(`/projects/${projectId}/chat-thread`, { method: 'PUT', body: JSON.stringify(messages.slice(-80)), headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
    prevStatus.current = status;
  }, [status]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || isLoading) return;
    setInput('');
    void sendMessage(t, { body: { autonomy, context: context() } } as any);
  };
  // 评论面板“交给 agent”
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const on = (e: Event) => sendRef.current((e as CustomEvent<string>).detail);
    window.addEventListener('plinth:ask', on);
    return () => window.removeEventListener('plinth:ask', on);
  }, []);

  const selection = view.selection
    .map(id => project.walls.find(w => w.id === id)?.name ?? project.spaces.find(x => x.id === id)?.name ?? project.furniture.find(f => f.id === id)?.name
      ?? project.walls.flatMap(w => w.openings).find(o => o.id === id)?.name)
    .filter(Boolean);

  const results = new Map<string, any>();
  for (const m of messages) for (const p of m.parts as any[]) if (p.type === 'tool-result') results.set(p.toolCallId, p);

  const blank = project.walls.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0 text-xs text-muted-foreground">
          {model ? <span className="truncate">模型：{model.label}</span> : <span>还没有配置模型</span>}
        </div>
        <Select value={autonomy} onValueChange={v => { setAuto(v as Autonomy); setAutonomy(v as Autonomy); }}>
          <SelectTrigger size="sm" className="h-7 w-auto gap-1 text-xs" aria-label="agent 自主程度">
            <SelectValue>{AUTONOMY_ZH[autonomy].label}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {(Object.keys(AUTONOMY_ZH) as Autonomy[]).map(k => (
              <SelectItem key={k} value={k}>
                <div className="flex flex-col">
                  <span>{AUTONOMY_ZH[k].label}</span>
                  <span className="text-xs text-muted-foreground">{AUTONOMY_ZH[k].hint}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!model && editable && (
        <Alert className="m-3 w-auto">
          <SettingsIcon />
          <AlertTitle>先配置大模型</AlertTitle>
          <AlertDescription>
            {role === 'owner' ? (
              <span>大模型由你自带。到 <Link to="/settings" className="underline">设置</Link> 添加密钥，再在右上角“分享”里给这个方案选用。</span>
            ) : (
              <span>请方案主人给这个方案配置大模型。</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 px-3">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<SparklesIcon className="size-6" />}
              title={blank ? '说说你想要什么样的房子' : '说说想怎么改'}
              description={blank ? '家里几口人、要几间房、地多大、偏好什么，我来排出第一版。' : '可以先在图上点选一面墙或一个房间，再说“这面墙……”。'}
            >
              <div className="mt-3 flex flex-col gap-2">
                {(blank ? SUGGESTIONS_BLANK : SUGGESTIONS).map(s => (
                  <Button key={s} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-1.5 text-left" disabled={!editable || !model} onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map(m => (
              <Message key={m.id} from={m.role === 'user' ? 'user' : 'assistant'}>
                <MessageContent>
                  {(m.parts as any[]).map((p, i) => {
                    if (p.type === 'text') return m.role === 'user' ? <p key={i} className="whitespace-pre-wrap">{p.content}</p> : <MessageResponse key={i}>{p.content}</MessageResponse>;
                    if (p.type === 'thinking') return (
                      <Reasoning key={i} isStreaming={isLoading}>
                        <ReasoningTrigger />
                        <ReasoningContent>{p.content}</ReasoningContent>
                      </Reasoning>
                    );
                    if (p.type === 'tool-call') {
                      const r = results.get(p.id);
                      const state = toolState(p, r);
                      const title = registry.get(p.name)?.title ?? p.name;
                      const out = p.output ?? (r ? safeJson(typeof r.content === 'string' ? r.content : '') : undefined);
                      return (
                        <Tool key={i}>
                          <ToolHeader type="dynamic-tool" toolName={p.name} title={title} state={state} />
                          <ToolContent>
                            <ToolInput input={p.input ?? safeJson(p.arguments)} />
                            {out !== undefined && <ToolOutput output={out} errorText={out?.ok === false ? out.error?.message : r?.error} />}
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {shots.map((s, i) => (
            <img key={i} src={s} alt="当前视图截图" className="rounded-md border" />
          ))}
          {isLoading && <Shimmer className="text-sm">正在思考…</Shimmer>}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {interrupts.map((it: any) =>
        it.kind === 'tool-approval' ? (
          <div key={it.id} className="mx-3 mb-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <p className="font-medium">agent 想要：{registry.get(it.toolName)?.title ?? it.toolName}</p>
            <p className="mt-1 text-muted-foreground">{describeCall(it.toolName, it.originalArgs, project)}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => it.resolveInterrupt(true)}>同意</Button>
              <Button size="sm" variant="outline" onClick={() => it.resolveInterrupt(false)}>不要</Button>
            </div>
          </div>
        ) : null,
      )}

      <ChangeCard />

      <form
        className="border-t p-3"
        onSubmit={e => {
          e.preventDefault();
          send(input);
        }}
      >
        {selection.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {selection.slice(0, 4).map(n => <Badge key={n} variant="secondary">已选：{n}</Badge>)}
          </div>
        )}
        <InputGroup>
          <InputGroupTextarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={!editable ? (readOnly ? '正在查看历史版本' : '你只有查看权限') : !model ? '先配置大模型' : '说说想怎么改…'}
            disabled={!editable || !model}
            rows={2}
            className="max-h-40"
          />
          <InputGroupAddon align="block-end" className="justify-end">
            {isLoading ? (
              <InputGroupButton size="icon-sm" variant="secondary" onClick={() => stop()} aria-label="停止">
                <CircleStopIcon />
              </InputGroupButton>
            ) : (
              <InputGroupButton type="submit" size="icon-sm" variant="default" disabled={!input.trim() || !editable || !model} aria-label="发送">
                <ArrowUpIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}
