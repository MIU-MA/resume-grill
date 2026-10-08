import { copyFileSync, cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const directory = resolve(root, 'public/generated')
mkdirSync(directory, { recursive: true })
copyFileSync(resolve(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'), resolve(directory, 'pdf.worker.min.mjs'))
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  cpSync(resolve(root, `node_modules/pdfjs-dist/${folder}`), resolve(directory, folder), { recursive: true })
}
