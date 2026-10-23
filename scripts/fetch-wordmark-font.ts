// Fetches the brand wordmark's font file, app/fonts/NotoSerifDisplay-CondensedExtraBold-wordmark.woff2:
// Noto Serif Display at the cups' condensed width (62.5) and ExtraBold weight (800), cut down by Google
// Fonts to the letters a wordmark needs. Every page preloads it, and the whole variable font was 76 KB
// where this is about 9 KB. Run it again only to add a letter to WORDMARK_GLYPHS:
//
//   node scripts/fetch-wordmark-font.ts
//
// The font is under the SIL Open Font License (app/fonts/OFL.txt), which allows a cut-down copy.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** The letters the file holds: any wordmark in any case, digits and the punctuation a café name takes. */
export const WORDMARK_GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,'’&-éÉ"

export const WORDMARK_FONT_FILE = fileURLToPath(
  new URL('../app/fonts/NotoSerifDisplay-CondensedExtraBold-wordmark.woff2', import.meta.url)
)

// Google Fonts answers with woff2 only when it recognises a browser that reads it.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** The Google Fonts stylesheet for the wordmark's face holding only `glyphs`. */
export function wordmarkCssUrl(glyphs: string): string {
  return `https://fonts.googleapis.com/css2?family=Noto+Serif+Display:wdth,wght@62.5,800&text=${encodeURIComponent(glyphs)}`
}

/** The font file's address in a Google Fonts stylesheet, or null when it has none. */
export function fontUrlFromCss(css: string): string | null {
  return /src:\s*url\(([^)]+)\)/.exec(css)?.[1] ?? null
}

async function main(): Promise<void> {
  const headers = { 'User-Agent': BROWSER_USER_AGENT }
  const css = await fetch(wordmarkCssUrl(WORDMARK_GLYPHS), { headers })
  if (!css.ok) throw new Error(`Google Fonts answered ${css.status} for the stylesheet.`)
  const fontUrl = fontUrlFromCss(await css.text())
  if (!fontUrl) throw new Error('The Google Fonts stylesheet named no font file.')
  const font = await fetch(fontUrl, { headers })
  if (!font.ok) throw new Error(`Google Fonts answered ${font.status} for the font file.`)
  const bytes = new Uint8Array(await font.arrayBuffer())
  await writeFile(WORDMARK_FONT_FILE, bytes)
  process.stdout.write(`Saved ${bytes.length} bytes to ${WORDMARK_FONT_FILE}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
