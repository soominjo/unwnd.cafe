import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fetch, withConfig } = vi.hoisted(() => {
  const fetch = vi.fn()
  return { fetch, withConfig: vi.fn(() => ({ fetch })) }
})
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig } }))

import { fetchPhotoPreviews } from './photoPreviews'

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetch.mockReset()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

describe('fetchPhotoPreviews', () => {
  it('maps each item with a photo to its blurred preview', async () => {
    fetch.mockResolvedValue([{ _id: 'a', lqip: 'data:a' }, { _id: 'b', lqip: null }])
    expect(await fetchPhotoPreviews()).toEqual({ a: 'data:a' })
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('image.asset->metadata.lqip'))
  })

  it('reads past the API CDN, like the rest of /menu, so a POS save shows at once', async () => {
    fetch.mockResolvedValue([])
    await fetchPhotoPreviews()
    expect(withConfig).toHaveBeenCalledWith({ useCdn: false })
  })

  it('gives no previews when Sanity cannot be read, so the menu still renders', async () => {
    fetch.mockRejectedValue(new Error('offline'))
    expect(await fetchPhotoPreviews()).toEqual({})
    expect(consoleError).toHaveBeenCalledWith('Menu photo previews could not be loaded', expect.any(Error))
  })
})
