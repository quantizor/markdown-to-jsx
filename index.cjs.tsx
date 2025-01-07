import _createMarkdown, { RuleType } from './'

// @ts-ignore
Object.assign(_createMarkdown, { RuleType })

export const createMarkdown = _createMarkdown as typeof createMarkdown & {
  RuleType: typeof RuleType
}
