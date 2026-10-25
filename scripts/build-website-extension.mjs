import { build } from 'esbuild'
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = resolve(root, 'src/browser-extension')
const output = resolve(root, 'dist/website-extension')
await mkdir(output, { recursive: true })
for (const file of ['manifest.json', 'popup.html', 'popup.css']) await copyFile(resolve(source, file), resolve(output, file))
await copyFile(resolve(root, 'LICENSE'), resolve(output, 'LICENSE'))
await build({ entryPoints: [resolve(source, 'background.ts'), resolve(source, 'popup.ts')], outdir: output, bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'chrome114', logLevel: 'warning' })
await build({ entryPoints: [resolve(source, 'bridge.ts'), resolve(source, 'form-content.ts')], outdir: output, bundle: true, minify: true, format: 'iife', platform: 'browser', target: 'chrome114', logLevel: 'warning' })
const zip = new JSZip()
for (const file of ['manifest.json', 'popup.html', 'popup.css', 'background.js', 'popup.js', 'bridge.js', 'form-content.js', 'LICENSE']) zip.file(`website-extension/${file}`, await readFile(resolve(output, file)))
await mkdir(resolve(root, 'public/generated'), { recursive: true })
await writeFile(resolve(root, 'public/generated/website-extension.zip'), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
console.log('扩展已生成：dist/website-extension。可在 Chrome / Edge 扩展管理页加载此目录。')
