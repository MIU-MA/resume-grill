import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = resolve(root, 'dist/release')
const name = 'resume-grill-website-extension.zip'
const bytes = await readFile(resolve(root, 'public/generated/website-extension.zip'))
await mkdir(output, { recursive: true })
await copyFile(resolve(root, 'public/generated/website-extension.zip'), resolve(output, name))
await writeFile(resolve(output, 'SHA256SUMS.txt'), `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`)
console.log('发布文件已生成：dist/release（扩展 ZIP 与 SHA-256 校验值）')
