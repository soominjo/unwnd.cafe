import { type SchemaTypeDefinition } from 'sanity'
import { menuItem } from './menuItem'
import { sale } from './sale'
import { saleItem } from './saleItem'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [menuItem, saleItem, sale],
}
