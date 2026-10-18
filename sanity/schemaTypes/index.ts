import { type SchemaTypeDefinition } from 'sanity'
import { menuItem } from './menuItem'
import { menuCategory } from './menuCategory'
import { menuSettings } from './menuSettings'
import { sale } from './sale'
import { saleItem } from './saleItem'
import { saleDiscount } from './saleDiscount'
import { salePayment } from './salePayment'
import { loyaltyMember } from './loyaltyMember'
import { staffMember } from './staffMember'
import { timeShift } from './timeShift'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [menuCategory, menuItem, menuSettings, saleItem, saleDiscount, salePayment, sale, loyaltyMember, staffMember, timeShift],
}
