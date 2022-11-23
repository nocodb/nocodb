import type { Ref } from 'vue'
import type { ViewType } from 'nocodb-sdk'
import { useState } from '#imports'

export function useFieldQuery(view: Ref<ViewType | undefined>) {
  // initial search object
  const emptyFieldQueryObj = {
    field: '',
    query: '',
  }

  // mapping view id (key) to corresponding emptyFieldQueryObj (value)
  const searchMap = useState<Record<string, { field: string; query: string }>>('field-query-search-map', () => ({}))

  // the fieldQueryObj under the current view
  const search = useState<{ field: string; query: string }>('field-query-search', () => emptyFieldQueryObj)

  // map current view id to emptyFieldQueryObj
  if (view?.value?.id) {
    searchMap.value[view!.value!.id] = search.value
  }

  // retrieve the fieldQueryObj of the given view id
  // if it is not found in `searchMap`, init with emptyFieldQueryObj
  const loadFieldQuery = (view: Ref<ViewType | undefined>) => {
    if (!view.value?.id) return
    if (!(view!.value!.id in searchMap.value)) {
      searchMap.value[view!.value!.id!] = emptyFieldQueryObj
    }
    search.value = searchMap.value[view!.value!.id!]
  }

  return { search, loadFieldQuery }
}
