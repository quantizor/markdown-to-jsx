# यह Markdown है

✨ आप मुझे संपादित कर सकते हैं! ✨

[Markdown](http://daringfireball.net/projects/markdown/) आपको बेहद स्वाभाविक तरीके से कंटेंट लिखने की सुविधा देता है।

- आप इस तरह की सूचियां बना सकते हैं
- चीजों को **बोल्ड** या _इटैलिक_ बना सकते हैं
- `code` के स्निपेट एम्बेड कर सकते हैं
- [लिंक](/) बना सकते हैं
- ...

<small>नमूना कंटेंट [elm-markdown](http://elm-lang.org/examples/markdown) से आभार के साथ लिया गया है ❤️</small>

> [!Tip]
> सामान्य और "अलर्ट" ब्लॉककोट्स संभव हैं। यदि आवश्यक हो तो अधिक नियंत्रण के लिए `renderRule` का उपयोग करें। `.markdown-alert-[type]` जैसी क्लासेज स्टाइलिंग हुक के रूप में प्रदान की गई हैं।

कोड ब्लॉक्स (या किसी भी नियम!) की कस्टम हैंडलिंग [`renderRule` विकल्प](https://github.com/quantizor/markdown-to-jsx#optionsrenderrule) के साथ संभव है। उदाहरण के लिए, [`@matejmazur/react-katex`](https://www.npmjs.com/package/@matejmazur/react-katex) के माध्यम से LaTeX समर्थन:

```latex
\mathbb{N} = \{ a \in \mathbb{Z} : a > 0 \}
```

या [`highlight.js`](https://highlightjs.org/) का उपयोग करके कोई भी अन्य सामान्य भाषा:

```javascript
function App() {
  return <div>नमस्कार दुनिया!</div>
}
```

यदि आप उन्हें [`overrides` विकल्प](https://github.com/quantizor/markdown-to-jsx/blob/main/README.md#optionsoverrides---rendering-arbitrary-react-components) में घोषित करते हैं तो आप कस्टम React कंपोनेंट भी शामिल कर सकते हैं।

<MyComponent>क्या यह बहुत _बढ़िया_ नहीं है?</MyComponent>
