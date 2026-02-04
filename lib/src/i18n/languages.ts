export type Language = {
  code: string
  name: string
  nativeName: string
  direction: 'ltr' | 'rtl'
}

export const LANGUAGES: Record<string, Language> = {
  en: { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr' },
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' },
}

export const DEFAULT_LANGUAGE = 'en'
export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGES)
