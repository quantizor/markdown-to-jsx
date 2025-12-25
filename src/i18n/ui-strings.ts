export const UI_STRINGS: Record<string, Record<string, string>> = {
  en: {
    input: 'Input',
    output: 'Output',
    otherExamples: 'Other examples',
    jumpToDocs: 'Jump to docs',
    loading: 'Loading...',
    presetGfmName: 'GFM Spec',
    presetGfmDesc: 'GitHub Flavored Markdown specification',
    presetMarkdownName: 'Original Markdown Spec',
    presetMarkdownDesc: 'Original Markdown specification',
    siteDesc:
      'A fast and versatile markdown toolchain, 100% GFM-CommonMark compliant. AST, React, React Native, SolidJS, Vue, Markdown, HTML, and round-trip Markdown output.',
    editTranslation: 'Edit translation ✎',
    demoAlert: "Look ma, I'm a real component!",
  },
  zh: {
    input: '输入',
    output: '输出',
    otherExamples: '其他示例',
    jumpToDocs: '跳转到文档',
    loading: '加载中...',
    presetGfmName: 'GFM规范',
    presetGfmDesc: 'GitHub风格Markdown规范',
    presetMarkdownName: '原始Markdown规范',
    presetMarkdownDesc: 'John Gruber 的原始 Markdown 语法规范',
    siteDesc:
      '一个快速、灵活的 Markdown 工具链，100% 兼容 GFM-CommonMark。支持 AST、React、React Native、SolidJS、Vue、Markdown、HTML 以及 Markdown 往返输出。',
    editTranslation: '编辑翻译 ✎',
    demoAlert: '看哪，我是一个真实的组件！',
  },
  hi: {
    input: 'इनपुट',
    output: 'आउटपुट',
    otherExamples: 'अन्य उदाहरण',
    jumpToDocs: 'दस्तावेज़ पर जाएं',
    loading: 'लोड हो रहा है...',
    presetGfmName: 'GFM विनिर्देश',
    presetGfmDesc: 'GitHub Flavored Markdown विनिर्देश',
    presetMarkdownName: 'मूल Markdown विनिर्देश',
    presetMarkdownDesc: 'John Gruber का मूल Markdown सिंटैक्स विनिर्देश',
    siteDesc:
      'एक तेज़ और बहुमुखी Markdown टूलचेन, 100% GFM-CommonMark अनुरूप। AST, React, React Native, SolidJS, Vue, Markdown, HTML, और राउंड-ट्रिप Markdown आउटपुट का समर्थन करता है।',
    editTranslation: 'अनुवाद संपादित करें ✎',
    demoAlert: 'देखिए, मैं एक वास्तविक कंपोनेंट हूं!',
  },
}

export const ALERT_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    NOTE: 'NOTE',
    TIP: 'TIP',
    IMPORTANT: 'IMPORTANT',
    WARNING: 'WARNING',
    CAUTION: 'CAUTION',
  },
  zh: {
    NOTE: '注意',
    TIP: '提示',
    IMPORTANT: '重要',
    WARNING: '警告',
    CAUTION: '小心',
  },
  hi: {
    NOTE: 'नोट',
    TIP: 'सुझाव',
    IMPORTANT: 'महत्वपूर्ण',
    WARNING: 'चेतावनी',
    CAUTION: 'सावधानी',
  },
}

export function translateAlertType(
  alertType: string,
  language: string = 'en'
): string {
  const normalized = alertType.toUpperCase()
  const translations = ALERT_TRANSLATIONS[language] || ALERT_TRANSLATIONS.en
  return translations[normalized] || alertType
}
