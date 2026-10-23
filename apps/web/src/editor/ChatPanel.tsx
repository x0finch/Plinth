/**
 * Chat with the agent. Every capability in the list is a browser-side tool: agent calls run here (same transaction and undo);
 * actions needing confirmation show a confirmation card. Chats are saved per user and per plan.
 */
import { findObject, type Project } from '@plinth/core';
import type { ToolApprovalInterrupt } from '@tanstack/ai-client';
import { Link } from '@tanstack/react-router';
import { ArrowUpIcon, CircleStopIcon, ShieldQuestionIcon, SparklesIcon, SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { registry } from '@/agent/registry';
import { m } from '@/lib/i18n';
import { AUTONOMIES, autonomyHint, autonomyLabel, getAutonomy, setAutonomy } from '@/lib/prefs';
import type { Autonomy } from '@/agent/policy';
import { can } from '@/shared/roles';
import { ChangeCard } from './chat/ChangeCard';
import { titleOf, type ToolResultPart } from './chat/common';
import { MessageView } from './chat/MessageView';
import { useAgentChat } from './chat/useAgentChat';
import { useEditor } from './store';

const SUGGESTIONS = [m.chat_suggestion_size, m.chat_suggestion_enlarge, m.chat_suggestion_window, m.chat_suggestion_check];
const SUGGESTIONS_BLANK = [m.chat_suggestion_blank_family, m.chat_suggestion_blank_yard];

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

export function ChatPanel() {
  const role = useEditor(s => s.role);
  const model = useEditor(s => s.model);
  const project = useEditor(s => s.project);
  const view = useEditor(s => s.view);
  const readOnly = useEditor(s => s.readOnlyVersion != null);
  const [autonomy, setAuto] = useState<Autonomy>('balanced');
  const [input, setInput] = useState('');
  const editable = can(role, 'editor') && !readOnly;
  useEffect(() => setAuto(getAutonomy()), []);

  const { messages, send: sendText, isLoading, stop, error, interrupts, shots } = useAgentChat({ autonomy, editable });
  const send = (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput('');
    sendText(text);
  };

  const selection = view.selection.map(id => findObject(project, id)?.name).filter(Boolean);
  const results = new Map<string, ToolResultPart>();
  for (const msg of messages) for (const p of msg.parts) if (p.type === 'tool-result') results.set(p.toolCallId, p);
  const blank = project.walls.length === 0;
  // needsApproval is decided per autonomy at runtime, so the tool types can't tell which calls may ask for approval
  const approvals = (interrupts as ReadonlyArray<{ kind: string }>).filter((it): it is ToolApprovalInterrupt => it.kind === 'tool-approval');

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
            messages.map(msg => <MessageView key={msg.id} msg={msg} results={results} streaming={isLoading} />)
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

      {approvals.map(it => (
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
      ))}

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
