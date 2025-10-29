import fs from 'fs'
import { parseMarkdown } from './src/index.tsx'

const content = fs.readFileSync('./src/fixture.md', 'utf8')

// Remove YAML front matter
const contentWithoutYAML = content.replace(
  /^---[ \t]*\n(.|\n)*\n---[ \t]*\n/,
  ''
)

console.log('Content length after YAML removal:', contentWithoutYAML.length)

// Test with increasing chunks
for (let size = 500; size <= contentWithoutYAML.length; size += 500) {
  console.log(`Testing first ${size} characters...`)
  try {
    const result = parseMarkdown(contentWithoutYAML.slice(0, size), false)
    console.log(`First ${size}: OK (${result.length} nodes)`)
  } catch (e) {
    console.log(`First ${size}: ERROR`, e.message)
    break
  }
  if (size >= contentWithoutYAML.length) {
    console.log('All content parsed successfully!')
  }
}
