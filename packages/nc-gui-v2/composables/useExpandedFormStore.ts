import { useInjectionState,  } from '#imports'

const [useProvideExpandedFormStore, useExpandedFormStore] = useInjectionState(() => {

},'expanded-form-store')




export { useProvideExpandedFormStore }

export function useExpandedFormStoreOrThrow() {
  const expandedFormStore = useExpandedFormStore()
  if (expandedFormStore == null) throw new Error('Please call `useExpandedFormStore` on the appropriate parent component')
  return expandedFormStore
}
