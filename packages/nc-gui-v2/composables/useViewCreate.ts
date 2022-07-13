import type { TableType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useNuxtApp } from '#app'
import type { ViewType } from '~/components'
import useMetas from '~/composables/useMetas'

export default (meta: Ref<TableType>, onViewCreate?: (viewMeta: any) => void) => {
  const view = reactive<{ title: string; type?: ViewTypes }>({
    title: '',
  })

  const loading = ref(false)

  const { $api } = useNuxtApp()
  const toast = useToast()
  const { metas } = useMetas()

  const createView = async (viewType: ViewTypes, selectedViewId = null) => {
    loading.value = true

    try {
      let data
      switch (viewType) {
        case ViewTypes.GRID:
          // todo: update swagger
          data = await $api.dbView.gridCreate(
            meta?.value?.id as string,
            {
              title: view?.title,
              copy_from_id: selectedViewId,
            } as any,
          )
          break
        case ViewTypes.GALLERY:
          data = await $api.dbView.galleryCreate(
            meta?.value?.id as string,
            {
              title: view?.title,
              copy_from_id: selectedViewId,
            } as any,
          )
          break
        case ViewTypes.FORM:
          data = await $api.dbView.formCreate(
            meta?.value?.id as string,
            {
              title: view?.title,
              copy_from_id: selectedViewId,
            } as any,
          )
          break
      }
      toast.success('View created successfully')
      onViewCreate?.(data)
    } catch (e) {
      toast.error(e.message)
    }

    loading.value = false
  }

  const generateUniqueTitle = (views: ViewType[]) => {
    let c = 1
    while (views?.some((t) => t.title === `${meta?.value?.title}${c}`)) {
      c++
    }
    view.title = `${meta?.value?.title}${c}`
  }

  return { view, createView, generateUniqueTitle, loading }
}
