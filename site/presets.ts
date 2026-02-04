export type Preset = {
  id: string
  nameKey: string
  descriptionKey: string
  load: (lang: string) => Promise<string>
}

export const presets: Preset[] = [
  {
    id: 'gfm',
    nameKey: 'presetGfmName',
    descriptionKey: 'presetGfmDesc',
    load: async (lang: string) => {
      try {
        const module = await import(`../lib/src/i18n/${lang}/gfm-spec.md?raw`)
        return module.default
      } catch {
        const fallback = await import('../lib/src/i18n/en/gfm-spec.md?raw')
        return fallback.default
      }
    },
  },
  {
    id: 'markdown',
    nameKey: 'presetMarkdownName',
    descriptionKey: 'presetMarkdownDesc',
    load: async (lang: string) => {
      try {
        const module = await import(`../lib/src/i18n/${lang}/markdown-spec.md?raw`)
        return module.default
      } catch {
        const fallback = await import('../lib/src/i18n/en/markdown-spec.md?raw')
        return fallback.default
      }
    },
  },
]

export function getPreset(id: string): Preset | undefined {
  return presets.find(p => p.id === id)
}
