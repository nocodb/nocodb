export function useFieldQuery() {
  // initial search object
  const emptyFieldQueryObj = {
    field: '',
    query: '',
  }

  // mapping view id (key) to corresponding emptyFieldQueryObj (value)
  const searchMap = useState<Record<string, { field: string; query: string }>>('field-query-search-map', () => ({}))

  // the fieldQueryObj under the current view
  const search = useState<{ field: string; query: string }>('field-query-search', () => ({ ...emptyFieldQueryObj }))

  // retrieve the fieldQueryObj of the given view id
  // if it is not found in `searchMap`, init with emptyFieldQueryObj
  const loadFieldQuery = (id?: string) => {
    if (!id) return
    if (!(id in searchMap.value)) {
      searchMap.value[id] = { ...emptyFieldQueryObj }
    }
    search.value = searchMap.value[id]
  }

  return { search, loadFieldQuery }
}
