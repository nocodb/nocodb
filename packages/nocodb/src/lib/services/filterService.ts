import Filter from '../models/Filter'

export async function filterGet(param: { filterId: string }) {
  const filter = await Filter.get(param.filterId)
  return filter
}

export async function filterList(param: { viewId: string }) {
  const filter = await Filter.rootFilterList({ viewId: param.viewId })
  return filter
}
