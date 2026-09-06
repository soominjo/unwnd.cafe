import { type SchemaTypeDefinition } from 'sanity'
import { menuItem } from './menuItem'
import { menuCategory } from './menuCategory'
import { menuSettings } from './menuSettings'
import { sale } from './sale'
import { saleItem } from './saleItem'
import { saleDiscount } from './saleDiscount'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [menuCategory, menuItem, menuSettings, saleItem, saleDiscount, sale],
}
