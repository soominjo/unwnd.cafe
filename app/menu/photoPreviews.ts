import { client } from '@/sanity/lib/client'

// Read past the API CDN like the rest of /menu (lib/posMenu.ts), so the page a POS save
// re-renders already has the new photo's preview.
const fresh = client.withConfig({ useCdn: false })

/**
 * Sanity's tiny blurred copy (lqip) of every menu photo, by item id, for /menu to show while
 * each photo loads. Kept out of the shared menu read so the POS never downloads them. Never
 * throws: without previews the photos simply load onto a plain tile.
 */
export async function fetchPhotoPreviews(): Promise<Record<string, string>> {
  try {
    const rows = await fresh.fetch<{ _id: string; lqip: string | null }[]>(
      `*[_type == "menuItem" && available != false && defined(image.asset)]{ _id, "lqip": image.asset->metadata.lqip }`
    )
    return Object.fromEntries(
      rows
        .filter((row): row is { _id: string; lqip: string } => typeof row.lqip === 'string')
        .map((row) => [row._id, row.lqip])
    )
  } catch (error) {
    console.error('Menu photo previews could not be loaded', error)
    return {}
  }
}
