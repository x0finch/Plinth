/**
 * Chat with the agent. Every capability in the list is a browser-side tool: agent calls run here (same transaction and undo);
 * actions needing confirmation show a confirmation card. Chats are saved per user and per plan.
 */
import { capabilityTitle, findObject, type Project } from '@plinth/core';
import { toolDefinition } from '@tanstack/ai';
import { clientTools } from '@tanstack/ai-client';
import { fetchServerSentEvents, useChat, type UIMessage } from '@tanstack/ai-react';
import { Link } from '@tanstack/react-router';
import { ArrowUpIcon, CircleStopIcon, Columns2Icon, Undo2Icon, ShieldQuestionIcon, SparklesIcon, SettingsIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { registry } from '@/agent/registry';
import type { AgentContext } from '@/agent/prompt';
import { api, can } from '@/lib/api';
import { m } from '@/lib/i18n';
import { AUTONOMIES, autonomyHint, autonomyLabel, getAutonomy, setAutonomy } from '@/lib/prefs';
import { needsApproval, type Autonomy } from '@/agent/policy';
import { useEditor, useEditorStore } from './store';

const SUGGESTIONS = [m.chat_suggestion_size, m.chat_suggestion_enlarge, m.chat_suggestion_window, m.chat_suggestion_check];
const SUGGESTIONS_BLANK = [m.chat_suggestion_blank_family, m.chat_suggestion_blank_yard];

/** Capability title in the UI language */
function titleOf(name: string) {
  const c = registry.get(name);
  return c ? capabilityTitle(c) : name;
}

/** Describe a capability call in one sentence (for the confirmation card) */
function describeCall(name: string, args: unknown, project: Project) {
  const c = registry.get(name);
  if (c?.mode === 'edit') {
    try {
      return c.label(c.input.parse(args), project);
    } catch {}
  }
  return m.chat_call_fallback({ title: titleOf(name), args: JSON.stringify(args) });
}

/** Strip large fields useless to the model (screenshots) */
function forModel(r: Awaited<ReturnType<typeof registry.call>>) {
  const res = r.result as any;
  if (res && typeof res === 'object' && typeof res.image === 'string') return { ...r, result: { ...res, image: '(shown to the owner)' } };
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
    <Card size="sm" className="mx-3 mb-2 gap-1 px-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{last.label}</span>
        <div className="flex gap-1">
          <Button size="xs" variant={compare ? 'secondary' : 'ghost'} onClick={() => setCompare(!compare)}>
            <Columns2Icon /> {compare ? m.chat_hide_before() : m.chat_compare_before()}
          </Button>
          <Button size="xs" variant="ghost" onClick={undo}>
            <Undo2Icon /> {m.chat_undo()}
          </Button>
        </div>
      </div>
      {(changes.length > 0 || added.length > 0 || removed.length > 0) && (
        <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
          {changes.map(c => (
            <li key={c.id}>
              {m.chat_area_changed({ name: c.name, before: c.before!.toFixed(1) })}<span className="text-foreground">{c.after!.toFixed(1)} m²</span>{m.chat_area_delta({ delta: `${c.after! > c.before! ? '+' : ''}${(c.after! - c.before!).toFixed(1)}` })}
            </li>
          ))}
          {added.map(c => <li key={c.id}>{m.chat_area_added({ name: c.name, area: c.after!.toFixed(1) })}</li>)}
          {removed.map(c => <li key={c.id}>{m.chat_area_removed({ name: c.name })}</li>)}
        </ul>
      )}
      {last.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {last.warnings.map((w, i) => <li key={i} className="flex gap-1"><TriangleAlertIcon className="size-3.5 shrink-0 text-chart-1" />{w.message}</li>)}
        </ul>
      )}
    </Card>
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
    return {
      projectName: p.name,
      role: s.role,
      uiLanguage: document.documentElement.lang,
      view: { mode: s.view.mode, level: p.levels.find(l => l.id === s.view.level)?.name ?? s.view.level },
      selection: s.view.selection.map(id => {
        const o = findObject(p, id);
        return { id, name: o?.name ?? id, type: o?.kind ?? 'unknown' };
      }),
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

  // Load chat history
  useEffect(() => {
    api<UIMessage[]>(`/projects/${projectId}/chat-thread`)
      .then(saved => Array.isArray(saved) && saved.length && setMessages(saved as any))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [projectId]);

  // Save the chat after each turn
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
  // "Hand to agent" from the comments panel
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const on = (e: Event) => sendRef.current((e as CustomEvent<string>).detail);
    window.addEventListener('plinth:ask', on);
    return () => window.removeEventListener('plinth:ask', on);
  }, []);

  const selection = view.selection.map(id => findObject(project, id)?.name).filter(Boolean);

  const results = new Map<string, any>();
  for (const msg of messages) for (const p of msg.parts as any[]) if (p.type === 'tool-result') results.set(p.toolCallId, p);

  const blank = project.walls.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0 text-xs text-muted-foreground">
          {model ? <span className="truncate">{m.chat_model({ label: model.label })}</span> : <span>{m.chat_no_model()}</span>}
        </div>
        <Select value={autonomy} onValueChange={v => { setAuto(v as Autonomy); setAutonomy(v as Autonomy); }}>
          <SelectTrigger size="sm" className="h-7 w-auto gap-1 text-xs" aria-label={m.chat_autonomy_aria()}>
            <SelectValue>{autonomyLabel(autonomy)}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {AUTONOMIES.map(k => (
              <SelectItem key={k} value={k}>
                <div className="flex flex-col">
                  <span>{autonomyLabel(k)}</span>
                  <span className="text-xs text-muted-foreground">{autonomyHint(k)}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!model && editable && (
        <Alert className="m-3 w-auto">
          <SettingsIcon />
          <AlertTitle>{m.chat_setup_model_title()}</AlertTitle>
          <AlertDescription>
            {role === 'owner' ? (
              <span>{m.chat_setup_model_owner_before()}<Button variant="link" className="h-auto p-0" nativeButton={false} render={<Link to="/settings" />}>{m.chat_setup_model_owner_link()}</Button>{m.chat_setup_model_owner_after()}</span>
            ) : (
              <span>{m.chat_setup_model_member()}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 px-3">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<SparklesIcon className="size-6" />}
              title={blank ? m.chat_empty_title_blank() : m.chat_empty_title()}
              description={blank ? m.chat_empty_description_blank() : m.chat_empty_description()}
            >
              <div className="mt-3 flex flex-col gap-2">
                {(blank ? SUGGESTIONS_BLANK : SUGGESTIONS).map(suggestion => suggestion()).map(s => (
                  <Button key={s} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-1.5 text-left" disabled={!editable || !model} onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map(msg => (
              <Message key={msg.id} from={msg.role === 'user' ? 'user' : 'assistant'}>
                <MessageContent>
                  {(msg.parts as any[]).map((p, i) => {
                    if (p.type === 'text') return msg.role === 'user' ? <p key={i} className="whitespace-pre-wrap">{p.content}</p> : <MessageResponse key={i}>{p.content}</MessageResponse>;
                    if (p.type === 'thinking') return (
                      <Reasoning key={i} isStreaming={isLoading}>
                        <ReasoningTrigger />
                        <ReasoningContent>{p.content}</ReasoningContent>
                      </Reasoning>
                    );
                    if (p.type === 'tool-call') {
                      const r = results.get(p.id);
                      const state = toolState(p, r);
                      const title = titleOf(p.name);
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
            <img key={i} src={s} alt={m.chat_screenshot_alt()} className="rounded-md border" />
          ))}
          {isLoading && <Shimmer className="text-sm">{m.chat_thinking()}</Shimmer>}
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
          <Alert key={it.id} className="mx-3 mb-2 w-auto">
            <ShieldQuestionIcon />
            <AlertTitle>{m.chat_approval_title({ title: titleOf(it.toolName) })}</AlertTitle>
            <AlertDescription>
              <p>{describeCall(it.toolName, it.originalArgs, project)}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => it.resolveInterrupt(true)}>{m.chat_approve()}</Button>
                <Button size="sm" variant="outline" onClick={() => it.resolveInterrupt(false)}>{m.chat_deny()}</Button>
              </div>
            </AlertDescription>
          </Alert>
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
            {selection.slice(0, 4).map(n => <Badge key={n} variant="secondary">{m.chat_selected({ name: n ?? '' })}</Badge>)}
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
            placeholder={!editable ? (readOnly ? m.chat_placeholder_history() : m.chat_placeholder_viewer()) : !model ? m.chat_placeholder_no_model() : m.chat_placeholder()}
            disabled={!editable || !model}
            rows={2}
            className="max-h-40"
          />
          <InputGroupAddon align="block-end" className="justify-end">
            {isLoading ? (
              <InputGroupButton size="icon-sm" variant="secondary" onClick={() => stop()} aria-label={m.chat_stop()}>
                <CircleStopIcon />
              </InputGroupButton>
            ) : (
              <InputGroupButton type="submit" size="icon-sm" variant="default" disabled={!input.trim() || !editable || !model} aria-label={m.chat_send()}>
                <ArrowUpIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}
