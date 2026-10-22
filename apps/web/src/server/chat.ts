/**
 * agent 对话：TanStack AI。能力全部作为浏览器端工具（在打开方案的浏览器里执行），
 * 服务端只负责用项目配置的密钥调用大模型、转发流式回复、记用量。
 */
import { chat, chatParamsFromRequestBody, maxIterations, toolDefinition, toServerSentEventsResponse, type ChatMiddleware } from '@tanstack/ai';
import { createAnthropicChat } from '@tanstack/ai-anthropic';
import { createGeminiChat } from '@tanstack/ai-gemini';
import { createOpenaiChat } from '@tanstack/ai-openai';
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible';
import { createOpenRouterText } from '@tanstack/ai-openrouter';
import { isAutonomy, needsApproval, type Autonomy } from '../agent/policy';
import { registry } from '../agent/registry';
import { SYSTEM_PROMPT, contextPrompt, type AgentContext } from '../agent/prompt';
import type { ModelConfigRow } from './repo';

export type { Autonomy };

/** 用得少的能力按需加载，省 token */
const LAZY = new Set(['history_log', 'search_capabilities', 'constraint_remove', 'wall_update', 'space_merge', 'space_remove', 'list_constraints']);

export function agentTools(autonomy: Autonomy) {
  return registry.list().map(c =>
    toolDefinition({
      name: c.name,
      description: `${c.title}：${c.description}`,
      inputSchema: c.input,
      needsApproval: needsApproval(c, autonomy),
      lazy: LAZY.has(c.name),
    }),
  );
}

function adapter(cfg: ModelConfigRow, apiKey: string) {
  const model = cfg.model as never;
  switch (cfg.provider) {
    case 'anthropic': return createAnthropicChat(model, apiKey);
    case 'openai': return createOpenaiChat(model, apiKey);
    case 'gemini': return createGeminiChat(model, apiKey);
    case 'openrouter': return createOpenRouterText(model, apiKey);
    case 'compatible': return openaiCompatibleText(cfg.model, { baseURL: cfg.base_url!, apiKey });
    default: throw new Error(`不支持的厂商 ${cfg.provider}`);
  }
}

export async function handleChat(request: Request, o: { config: ModelConfigRow; apiKey: string; onUsage: (input: number, output: number) => Promise<unknown> }) {
  let params;
  try {
    params = await chatParamsFromRequestBody(await request.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '请求格式不对' }, { status: 400 });
  }
  const props = params.forwardedProps as { autonomy?: Autonomy; context?: AgentContext };
  const autonomy: Autonomy = isAutonomy(props.autonomy) ? props.autonomy : 'balanced';

  let input = 0, output = 0;
  const usage: ChatMiddleware = {
    name: 'usage',
    onUsage(_ctx, u) {
      input += u.promptTokens ?? 0;
      output += u.completionTokens ?? 0;
    },
    onFinish: async () => void (await o.onUsage(input, output)),
    onAbort: async () => void (await o.onUsage(input, output)),
    onError: async () => void (await o.onUsage(input, output)),
  };

  const abortController = new AbortController();
  request.signal.addEventListener('abort', () => abortController.abort());
  // 厂商在运行时才确定，类型上按任意适配器处理
  const options: any = {
    adapter: adapter(o.config, o.apiKey),
    messages: params.messages,
    threadId: params.threadId,
    runId: params.runId,
    systemPrompts: [SYSTEM_PROMPT, contextPrompt(props.context)],
    tools: agentTools(autonomy),
    agentLoopStrategy: maxIterations(40),
    lazyToolsConfig: { includeDescription: 'first-sentence' },
    middleware: [usage],
    abortController,
    ...(params.resume ? { resume: params.resume, parentRunId: params.parentRunId } : {}),
    ...(o.config.provider === 'anthropic' ? { modelOptions: { max_tokens: 8192 } } : {}),
  };
  const stream = chat(options) as unknown as Parameters<typeof toServerSentEventsResponse>[0];
  return toServerSentEventsResponse(stream, { abortController });
}
