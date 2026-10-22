/** 用户可选的大模型厂商。适配器由 TanStack AI 提供，这里只列元信息和推荐型号。 */
export interface ProviderInfo {
  name: string;
  models: string[];
  needsBaseUrl?: boolean;
  hint: string;
}

export const PROVIDERS: Record<string, ProviderInfo> = {
  anthropic: { name: 'Anthropic', models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'], hint: '在 console.anthropic.com 创建 API Key' },
  openai: { name: 'OpenAI', models: ['gpt-5.5', 'gpt-5', 'gpt-4.1'], hint: '在 platform.openai.com 创建 API Key' },
  gemini: { name: 'Google Gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash'], hint: '在 aistudio.google.com 创建 API Key' },
  openrouter: { name: 'OpenRouter', models: ['anthropic/claude-sonnet-5.5', 'deepseek/deepseek-v4-pro', 'qwen/qwen3-max'], hint: '一把 Key 可用多家模型，国内模型推荐走这里' },
  compatible: { name: 'OpenAI 兼容接口', models: ['deepseek-chat', 'qwen-max'], needsBaseUrl: true, hint: '如 DeepSeek（https://api.deepseek.com/v1）、通义（https://dashscope.aliyuncs.com/compatible-mode/v1）' },
};
