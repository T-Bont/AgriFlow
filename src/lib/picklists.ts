import { get, set } from 'idb-keyval'

const PICKLISTS_KEY = 'agriflow-picklists'

export interface Picklists {
  vendors: string[]
  productNames: string[]
  applicationStages: string[]
}

export async function getPicklists(): Promise<Picklists> {
  const raw = await get<Partial<Picklists>>(PICKLISTS_KEY)
  return {
    vendors: raw?.vendors ?? [],
    productNames: raw?.productNames ?? [],
    applicationStages: raw?.applicationStages ?? [],
  }
}

export async function mergeAndSavePicklists(
  vendors: string[],
  productNames: string[],
  applicationStages: string[] = [],
): Promise<void> {
  const current = await getPicklists()
  const vendorSet = new Set([...current.vendors, ...vendors.filter(Boolean)])
  const productSet = new Set([...current.productNames, ...productNames.filter(Boolean)])
  await set(PICKLISTS_KEY, {
    vendors: [...vendorSet].sort(),
    productNames: [...productSet].sort(),
    applicationStages: [...new Set([...current.applicationStages, ...applicationStages.filter(Boolean)])].sort(),
  })
}
