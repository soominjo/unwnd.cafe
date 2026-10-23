import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { WORDMARK_FONT_FILE, WORDMARK_GLYPHS, fontUrlFromCss, wordmarkCssUrl } from './fetch-wordmark-font'

describe('the brand wordmark font', () => {
  it("asks Google Fonts for Noto Serif Display at the cups' condensed width and weight, cut to the given letters", () => {
    expect(wordmarkCssUrl('ab')).toBe('https://fonts.googleapis.com/css2?family=Noto+Serif+Display:wdth,wght@62.5,800&text=ab')
  })

  it('escapes the letters a web address cannot carry as they are', () => {
    expect(wordmarkCssUrl('é &’')).toContain('text=%C3%A9%20%26%E2%80%99')
  })

  it('holds every letter of every wordmark the site and the POS show', () => {
    const marks = ['unwnd', 'unwnd.cafe', 'unwnd. café', 'unwnd. pos', 'unwnd. sales', 'unwnd. time clock', 'unwnd. manager', 'UNWND CAFE']
    const missing = [...new Set(marks.join(''))].filter((letter) => !WORDMARK_GLYPHS.includes(letter))
    expect(missing).toEqual([])
  })

  it('reads the font address out of the stylesheet Google answers with', () => {
    const css = "@font-face {\n  font-family: 'Noto Serif Display';\n  font-weight: 800;\n  src: url(https://fonts.gstatic.com/l/font?kit=abc&skey=1&v=v29) format('woff2');\n}\n"
    expect(fontUrlFromCss(css)).toBe('https://fonts.gstatic.com/l/font?kit=abc&skey=1&v=v29')
  })

  it('finds no font address in a stylesheet without one', () => {
    expect(fontUrlFromCss('body { color: red }')).toBeNull()
  })

  // Every page preloads it, so a full font slipped in here would cost each visit about 70 KB.
  it('is committed as a woff2 file of under 12 KB', () => {
    const bytes = readFileSync(WORDMARK_FONT_FILE)
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2')
    expect(bytes.length).toBeLessThan(12_000)
  })
})
