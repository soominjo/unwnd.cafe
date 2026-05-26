export interface SanityMenuItem {
  _id: string
  name: string
  price: number
  priceHot?: number
  priceIce?: number
  category: string
  description?: string
  image?: { asset: { _ref: string } }
  drinkType?: 'hot' | 'iced' | 'both'
  sizes?: string[]
  ingredients?: string[]
  available?: boolean
  featured?: boolean
}
