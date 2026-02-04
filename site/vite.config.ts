import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import packageJson from '../lib/package.json'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

var rootDir = resolve(__dirname, '..')

function copyLlmsTxtPlugin(): Plugin {
  return {
    name: 'copy-llms-txt',
    closeBundle() {
      var readmePath = join(rootDir, 'lib', 'README.md')
      var outputPath = join(rootDir, 'docs', 'llms.txt')
      var readmeContent = readFileSync(readmePath, 'utf-8')
      mkdirSync(join(rootDir, 'docs'), { recursive: true })
      writeFileSync(outputPath, readmeContent, 'utf-8')
    },
  }
}

function generateSitemapPlugin(): Plugin {
  return {
    name: 'generate-sitemap',
    closeBundle() {
      const baseUrl = 'https://markdown-to-jsx.quantizor.dev'
      const lastmod = new Date().toISOString().split('T')[0]
      const sitemapPath = join(rootDir, 'docs', 'sitemap.xml')

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/llms.txt</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`

      writeFileSync(sitemapPath, sitemap, 'utf-8')
    },
  }
}

export default defineConfig({
  appType: 'spa',
  plugins: [
    react({
      // Exclude the file that uses custom classic JSX
      exclude: /\/react\.tsx$/,
    }),
    tailwindcss(),
    copyLlmsTxtPlugin(),
    generateSitemapPlugin(),
  ],
  define: {
    VERSION: JSON.stringify(packageJson.version.split('.')[0]),
  },
  resolve: {
    alias: {
      '#entities': resolve(rootDir, 'lib/src/entities.generated.ts'),
    },
  },
  root: '.',
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, 'docs'),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
    copyPublicDir: true,
  },
  server: {
    allowedHosts: ['dev.local'],
    port: 3000,
    open: false,
    fs: {
      allow: ['..'],
    },
  },
})
