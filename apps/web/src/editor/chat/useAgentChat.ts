/**
 * The agent conversation for the open project: every capability is a browser-side tool (same transaction and undo as the UI),
 * the thread is loaded and saved per user and project, and messages handed over with `askAgent` are sent here.
 */
import { toolDefinition } from '@tanstack/ai';
import { clientTools } from '@tanstack/ai-client';
import { fetchServerSentEvents, useChat, type UIMessage } from '@tanstack/ai-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { agentContext } from '@/agent/context';
import { needsApproval, type Autonomy } from '@/agent/policy';
import { registry } from '@/agent/registry';
import { api } from '@/lib/api';
import { useEditor, useEditorStore } from '../store';

type CallResult = Awaited<ReturnType<typeof registry.call>>;

/** Strip large fields useless to the model (screenshots) */
function forModel(r: CallResult) {
  const res = r.result as { image?: unknown } | undefined;
  if (res && typeof res === 'object' && typeof res.image === 'string') return { ...r, result: { ...res, image: '(shown to the owner)' } };
  return r;
}

export function useAgentChat({ autonomy, editable }: { autonomy: Autonomy; editable: boolean }) {
  const store = useEditorStore();
  const projectId = useEditor(s => s.projectId);
  const ask = useEditor(s => s.ask);
  const [shots, setShots] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const tools = useMemo(
    () =>
      clientTools(
        ...registry.list().map(c =>
          toolDefinition({ name: c.name, description: c.title, inputSchema: c.input, needsApproval: needsApproval(c, autonomy) }).client(async (args: unknown) => {
            const r = await store.getState().call(c.name, args, { kind: 'agent' });
            const img = (r.result as { image?: unknown } | undefined)?.image;
            if (typeof img === 'string') setShots(s => [...s, img]);
            return forModel(r);
          }),
        ),
      ),
    [store, autonomy],
  );

  const chat = useChat({ connection: fetchServerSentEvents(`/api/projects/${projectId}/chat`), tools, body: { autonomy } });
  const { messages, sendMessage, isLoading, setMessages, status } = chat;

  // Load the saved thread
  useEffect(() => {
    api<UIMessage[]>(`/projects/${projectId}/chat-thread`)
      .then(saved => Array.isArray(saved) && saved.length && setMessages(saved as typeof messages))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [projectId]);

  // Save the thread after each turn
  const prevStatus = useRef(status);
  useEffect(() => {
    if (loaded && editable && prevStatus.current !== 'ready' && status === 'ready' && messages.length) {
      api(`/projects/${projectId}/chat-thread`, { method: 'PUT', json: messages.slice(-80) }).catch(() => {});
    }
    prevStatus.current = status;
  }, [status]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || isLoading) return;
    void sendMessage(t, { body: { autonomy, context: agentContext(store.getState()) } });
  };

  // Messages handed over from elsewhere in the editor (e.g. "ask the agent" on a comment)
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (ask) sendRef.current(ask.text);
  }, [ask]);

  return { ...chat, send, shots };
}
