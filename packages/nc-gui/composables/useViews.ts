import type { TableType, ViewType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { ref, unref, useNuxtApp, watch } from '#imports'
import type { SectionType } from '~/lib'

export function useViews(meta: MaybeRef<TableType | undefined>) {
  const sections = ref<SectionType[]>([])
  const isLoading = ref(false)

  const { $api } = useNuxtApp()

  const loadViews = async () => {
    isLoading.value = true
    const _meta = unref(meta)

    if (_meta && _meta.id) {
      const response = (await $api.dbView.list(_meta.id)).list as ViewType[]
      if (response) {
        const views = response.sort((a, b) => a.order! - b.order!)
        const sectionNames = [...new Set(views.map((v) => v.section).filter((v) => v))].sort() as string[]
        sectionNames.push('')
        sections.value = sectionNames.map((name) => ({
          name,
          views: views.filter((v) => {
            if (name === '') {
              return !v.section
            } else {
              return v.section === name
            }
          }),
        }))
      }
    }

    isLoading.value = false
  }

  watch(() => unref(meta), loadViews, { immediate: true })

  return { sections, isLoading, loadViews }
}
