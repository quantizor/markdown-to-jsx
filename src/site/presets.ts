export type Preset = {
  id: string
  name: string
  description: string
  load: () => Promise<string>
}

// @ts-ignore
import gfmSpec from '../gfm-spec.md?raw'
// @ts-ignore
import markdownSpec from '../markdown-spec.md?raw'

export const presets: Preset[] = [
  {
    id: 'gfm',
    name: 'GFM Spec',
    description: 'GitHub Flavored Markdown specification',
    load: async () => gfmSpec,
  },
  {
    id: 'markdown',
    name: 'Original Markdown Spec',
    description: 'Original Markdown specification',
    load: async () => markdownSpec,
  },
]

export function getPreset(id: string): Preset | undefined {
  return presets.find(p => p.id === id)
}
