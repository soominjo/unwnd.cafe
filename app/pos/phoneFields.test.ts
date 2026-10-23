import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// iPhone Safari zooms into a text field whose text is under 16px as soon as it is focused, and
// leaves the page zoomed. So below 640px every POS text field is text-base (16px); tablets keep
// their sizes. This reads every field in the POS's code, so a new one can't miss it.

const POS_DIR = fileURLToPath(new URL('.', import.meta.url))

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx'))
    .map((entry) => join(entry.parentPath, entry.name))

// The tag as written, from "<input" to the ">" that ends it: braces, strings and template
// literals are skipped over, so "onChange={e => …}" doesn't end it early.
function tagAt(source: string, start: number): string {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1)
  }
  return source.slice(start)
}

// The field's classes: written in place, or a constant of the same file (`className={INPUT}`).
function classesOf(tag: string, source: string): string {
  const literal = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(tag)
  if (literal) return literal[1] ?? literal[2]
  const constant = /className=\{([A-Z_][A-Z0-9_]*)\}/.exec(tag)?.[1]
  if (!constant) return ''
  return new RegExp(`const ${constant}\\s*=\\s*['"\`]([^'"\`]*)['"\`]`).exec(source)?.[1] ?? ''
}

const textFields = sourceFiles(POS_DIR).flatMap((file) => {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(/<(input|textarea|select)\b/g)]
    .map((match) => tagAt(source, match.index))
    .filter((tag) => !/type="(checkbox|radio|range|hidden)"/.test(tag))
    .map((tag) => ({ where: relative(POS_DIR, file), classes: classesOf(tag, source) }))
})

const SIXTEEN_ON_PHONES = /(^|\s)(max-sm:)?text-base(\s|$)/

describe('POS text fields on a phone', () => {
  it('finds the fields to check', () => {
    expect(textFields.length).toBeGreaterThan(15)
  })

  it('sets every text field at 16px below 640px, so iPhone Safari never zooms in on one', () => {
    const small = textFields.filter((field) => !SIXTEEN_ON_PHONES.test(field.classes))
    expect(small).toEqual([])
  })
})
