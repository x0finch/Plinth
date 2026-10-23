/**
 * UI translations (Paraglide). Use `m.some_key()` for every user-visible string; never hard-code UI text.
 * Messages live in apps/web/messages/{locale}.json; a key missing from a locale falls back to Chinese.
 */
import { getLocale, locales, setLocale, type Locale } from '@/paraglide/runtime';

export { m } from '@/paraglide/messages';
export { getLocale, locales, setLocale, type Locale };

/** BCP 47 tag for <html lang> and for the agent's context */
export const htmlLang = (l: Locale = getLocale()) => (l === 'zh' ? 'zh-CN' : l);
