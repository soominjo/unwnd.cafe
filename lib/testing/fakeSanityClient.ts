// Test-only: an in-memory stand-in for the Sanity write client, covering the calls the sale
// routes make. Route tests assert on the stored documents it leaves, not on mock calls. It
// mirrors Sanity where the routes depend on it: a patch commits atomically and returns the
// new document, every commit gets a new _rev, ifRevisionId refuses a stale revision with
// statusCode 409, append needs the array to exist, and a query delete only removes documents
// of the _type the query names. Like @sanity/client's Patch, a patch holds ONE unset list and
// ONE insert: calling unset or append again replaces the earlier one, so a patch that appends
// to two arrays loses the first append, as it would against Sanity. Operations apply in
// Sanity's order: set, setIfMissing, unset, insert.

export interface FakeDoc {
  _id: string
  _type: string
  _rev?: string
  _createdAt?: string
  [field: string]: unknown
}

type Doc = FakeDoc & { _rev: string }

function sanityError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode })
}

const KEY_FILTER = /^(\w+)\[\s*_key\s*==\s*"([^"]+)"\s*\]$/

function unsetPath(doc: Doc, path: string): void {
  const keyed = KEY_FILTER.exec(path)
  if (keyed) {
    const [, field, key] = keyed
    const list = doc[field]
    if (Array.isArray(list)) doc[field] = list.filter((item: { _key?: string }) => item._key !== key)
    return
  }
  delete doc[path]
}

export function fakeSanityClient(seed: FakeDoc[]) {
  let revision = 0
  const nextRev = () => `rev-${++revision}`
  const store = new Map<string, Doc>(seed.map(d => [d._id, { _rev: nextRev(), ...structuredClone(d) }]))

  function patch(id: string) {
    let set: Record<string, unknown> = {}
    let setIfMissing: Record<string, unknown> = {}
    let unset: string[] = []
    let insert: { field: string; items: unknown[] } | null = null
    let expectedRev: string | null = null
    const builder = {
      ifRevisionId(rev: string) {
        expectedRev = rev
        return builder
      },
      set(fields: Record<string, unknown>) {
        set = { ...set, ...structuredClone(fields) }
        return builder
      },
      setIfMissing(fields: Record<string, unknown>) {
        setIfMissing = { ...setIfMissing, ...structuredClone(fields) }
        return builder
      },
      unset(paths: string[]) {
        unset = [...paths]
        return builder
      },
      append(field: string, items: unknown[]) {
        insert = { field, items: structuredClone(items) }
        return builder
      },
      async commit<T = Doc>(): Promise<T> {
        const current = store.get(id)
        if (!current) throw sanityError(404, `Document "${id}" not found`)
        if (expectedRev !== null && current._rev !== expectedRev) {
          throw sanityError(409, `Document "${id}" has unexpected revision ID ("${current._rev}"), expected "${expectedRev}"`)
        }
        const next: Doc = { ...structuredClone(current), ...set }
        for (const [field, value] of Object.entries(setIfMissing)) if (next[field] === undefined) next[field] = value
        unset.forEach(p => unsetPath(next, p))
        if (insert) {
          const list = next[insert.field]
          if (!Array.isArray(list)) throw sanityError(400, `Cannot append to "${insert.field}": it is not an array`)
          next[insert.field] = [...list, ...insert.items]
        }
        next._rev = nextRev()
        store.set(id, next)
        return structuredClone(next) as T
      },
    }
    return builder
  }

  const client = {
    async getDocument<T = Doc>(id: string): Promise<T | undefined> {
      const doc = store.get(id)
      return doc ? (structuredClone(doc) as T) : undefined
    },
    async delete(selection: string | { query: string; params: { id: string; rev?: string } }) {
      const id = typeof selection === 'string' ? selection : selection.params.id
      const doc = store.get(id)
      const type = typeof selection === 'string' ? null : /_type\s*==\s*"([^"]+)"/.exec(selection.query)?.[1] ?? null
      // A query that names `_rev == $rev` deletes the document only at that revision.
      const rev = typeof selection !== 'string' && /_rev\s*==\s*\$rev/.test(selection.query) ? selection.params.rev : undefined
      if (!doc || (type !== null && doc._type !== type) || (rev !== undefined && doc._rev !== rev)) return { results: [] }
      store.delete(id)
      return { results: [{ id, operation: 'delete' }] }
    },
    patch,
  }

  return {
    client,
    /** The stored document as the routes left it, or undefined once deleted. */
    doc: (id: string): Doc | undefined => {
      const doc = store.get(id)
      return doc ? structuredClone(doc) : undefined
    },
    /** Changes a stored document behind the route's back, as another device would. */
    touch: (id: string, fields: Record<string, unknown>) => {
      const doc = store.get(id)
      if (!doc) throw new Error(`No document ${id}`)
      store.set(id, { ...doc, ...structuredClone(fields), _rev: nextRev() })
    },
  }
}
