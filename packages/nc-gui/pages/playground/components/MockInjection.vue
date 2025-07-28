<script lang="ts" setup>
import { mockSetupInit } from '../-helper/mock-setup'
interface MockRefType {
  meta: globalThis.Ref
  view: globalThis.Ref
  filters: globalThis.Ref
  source: globalThis.Ref
  isPublic: globalThis.Ref
  readOnly: globalThis.Ref
  editMode: globalThis.Ref
}

const mockRef: MockRefType = {
  meta: ref(),
  view: ref(),
  source: ref(),
  filters: ref([]),
  isPublic: ref(false),
  readOnly: ref(false),
  editMode: ref(false),
}
const reloadEventHook = createEventHook()

const router = useRouter()

const route = router.currentRoute
const setMockRef = (handle: (mockRef: MockRefType) => void) => {
  handle(mockRef)
}

provide('get-mock-ref', mockRef)
provide('set-mock-ref', setMockRef)
provide(MetaInj, mockRef.meta)
provide(IsPublicInj, mockRef.isPublic)
provide(ReadonlyInj, mockRef.readOnly)
provide(ActiveSourceInj, mockRef.source)

useProvideSmartsheetStore(mockRef.view, mockRef.meta, true, ref([]), mockRef.filters)
useProvideMapViewStore(mockRef.meta, mockRef.view)
useProvideViewColumns(mockRef.view, mockRef.meta, () => reloadEventHook?.trigger(), mockRef.isPublic.value)

useViewRowColorProvider({ shared: true })

onMounted(async () => {
  const { meta, bases, baseId, view } = mockSetupInit()
  mockRef.meta.value = meta
  mockRef.view.value = view
  mockRef.source.value = bases.get(baseId)?.sources?.[0]
  route.value.params.typeOrId = baseId
})
</script>

<template>
  <slot></slot>
</template>
