import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

function generateLlmsTxt(): void {
  var readmePath = join(process.cwd(), 'README.md')
  var outputPath = join(process.cwd(), 'public', 'llms.txt')

  console.log('Reading README.md...')
  var readmeContent = readFileSync(readmePath, 'utf-8')

  console.log('Writing llms.txt...')
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, readmeContent, 'utf-8')

  console.log('Successfully generated public/llms.txt')
}

generateLlmsTxt()

