import { existsSync } from 'node:fs'
import { SUPPORTED_LANGUAGES } from '../src/i18n/languages'
import { UI_STRINGS } from '../src/i18n/ui-strings'

const REQUIRED_FILES = ['README.md', 'default-template.md', 'gfm-spec.md', 'markdown-spec.md']

function validateTranslations() {
  const errors: string[] = []

  // 1. Validate UI strings completeness
  const baseKeys = Object.keys(UI_STRINGS.en)

  for (const lang of SUPPORTED_LANGUAGES) {
    const langStrings = UI_STRINGS[lang]
    if (!langStrings) {
      errors.push(`[${lang}] Missing from UI_STRINGS`)
      continue
    }

    const langKeys = Object.keys(langStrings)
    const missing = baseKeys.filter(key => !langKeys.includes(key))
    const extra = langKeys.filter(key => !baseKeys.includes(key))

    if (missing.length > 0) {
      errors.push(`[${lang}] Missing UI strings: ${missing.join(', ')}`)
    }
    if (extra.length > 0) {
      errors.push(`[${lang}] Extra UI strings (not in en): ${extra.join(', ')}`)
    }
  }

  // 2. Validate required documentation files exist
  for (const lang of SUPPORTED_LANGUAGES) {
    for (const file of REQUIRED_FILES) {
      const path = `src/i18n/${lang}/${file}`
      if (!existsSync(path)) {
        errors.push(`[${lang}] Missing file: ${path}`)
      }
    }
  }

  // 3. Validate languages.ts and ui-strings.ts are in sync
  const uiLangs = Object.keys(UI_STRINGS)
  const registryLangs = SUPPORTED_LANGUAGES

  for (const lang of registryLangs) {
    if (!uiLangs.includes(lang)) {
      errors.push(`Language "${lang}" in registry but missing from UI_STRINGS`)
    }
  }

  for (const lang of uiLangs) {
    if (!registryLangs.includes(lang)) {
      errors.push(`Language "${lang}" in UI_STRINGS but missing from registry`)
    }
  }

  if (errors.length > 0) {
    console.error('❌ Translation validation failed:\n')
    errors.forEach(err => console.error(`  - ${err}`))
    process.exit(1)
  }

  console.log('✅ All translations are complete!')
}

validateTranslations()





