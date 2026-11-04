import { createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const extensionIconSizes = [16, 32, 48, 128]

/** One vector source for the toolbar, extensions page, and popup branding. */
export async function buildExtensionIcons(source, output) {
  const icon = await loadImage(await readFile(resolve(source, 'icon.svg')))
  await mkdir(resolve(output, 'icons'), { recursive: true })
  for (const size of extensionIconSizes) {
    const canvas = createCanvas(size, size)
    canvas.getContext('2d').drawImage(icon, 0, 0, size, size)
    await writeFile(resolve(output, `icons/icon-${size}.png`), canvas.toBuffer('image/png'))
  }
}
