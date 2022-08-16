import type { ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { IsPublicInj, ReloadViewDataHookInj, useMetas, useNuxtApp, useUIPermission } from '#imports'
import type { Filter } from '~/lib'

export function useViewFilters(
  view: Ref<ViewType> | undefined,
  parentId?: string,
  autoApply?: ComputedRef<boolean>,
  reloadData?: () => void,
  siblingFilters?: Filter[],
) {
  const { nestedFilters } = useSharedView()

  const reloadHook = inject(ReloadViewDataHookInj)

  const _filters = ref<Filter[]>([])

  const isPublic = inject(IsPublicInj, ref(false))
  const { $api } = useNuxtApp()
  const { isUIAllowed } = useUIPermission()
  const { metas } = useMetas()

  const filters = computed({
    get: () => (isPublic.value ? siblingFilters || nestedFilters.value : _filters.value),
    set: (value) => {
      if (isPublic.value) {
        if (siblingFilters) {
          siblingFilters = value
        } else {
          nestedFilters.value = value
        }
        nestedFilters.value = [...nestedFilters.value]
        reloadHook?.trigger()
      } else {
        _filters.value = value
      }
    },
  })

  const placeholderFilter: Filter = {
    comparison_op: 'eq',
    value: '',
    status: 'create',
    logical_op: 'and',
  }

  const loadFilters = async (hookId?: string) => {
    if (isPublic.value) return

    if (hookId) {
      if (parentId) {
        filters.value = await $api.dbTableFilter.childrenRead(parentId)
      } else {
        filters.value = (await $api.dbTableWebhookFilter.read(hookId as string)) as any
      }
    } else {
      if (parentId) {
        filters.value = await $api.dbTableFilter.childrenRead(parentId)
      } else {
        filters.value = await $api.dbTableFilter.read(view?.value?.id as string)
      }
    }
  }

  const sync = async (hookId?: string, _nested = false) => {
    for (const [i, filter] of Object.entries(filters.value)) {
      if (filter.status === 'delete') {
        await $api.dbTableFilter.delete(filter.id as string)
      } else if (filter.status === 'update') {
        await $api.dbTableFilter.update(filter.id as string, {
          ...filter,
          fk_parent_id: parentId,
        })
      } else if (filter.status === 'create') {
        if (hookId) {
          filters.value[+i] = (await $api.dbTableWebhookFilter.create(hookId, {
            ...filter,
            fk_parent_id: parentId,
          })) as any
        } else {
          filters.value[+i] = (await $api.dbTableFilter.create(view?.value?.id as string, {
            ...filter,
            fk_parent_id: parentId,
          })) as any
        }
      }
    }
    }
    reloadData?.()
  }

  const deleteFilter = async (filter: Filter, i: number) => {
    // if shared or sync permission not allowed simply remove it from array
    if (isPublic.value || !isUIAllowed('filterSync')) {
      filters.value.splice(i, 1)
      reloadData?.()
    } else {
      if (filter.id) {
        // if auto-apply disabled mark it as disabled
        if (!autoApply?.value) {
          filter.status = 'delete'
          // if auto-apply enabled invoke delete api and remove from array
        } else {
          await $api.dbTableFilter.delete(filter.id)
          reloadData?.()
          filters.value.splice(i, 1)
        }
        // if not synced yet remove it from array
      } else {
        filters.value.splice(i, 1)
      }
    }
  }

  const saveOrUpdate = async (filter: Filter, i: number, force = false) => {
    if (isPublic.value) {
      filters.value[i] = { ...filter } as any
      filters.value = [...filters.value]
      return
    }
    if (!view?.value) return
    if (!isUIAllowed('filterSync')) {
      // skip
    } else if (!autoApply?.value && !force) {
      filter.status = filter.id ? 'update' : 'create'
    } else if (filter.id) {
      await $api.dbTableFilter.update(filter.id, {
        ...filter,
        fk_parent_id: parentId,
      })
    } else {
      // todo: return type of dbTableFilter is void?
      filters.value[i] = (await $api.dbTableFilter.create(view?.value?.id as string, {
        ...filter,
        fk_parent_id: parentId,
      })) as any
    }
    reloadData?.()
  }

  const addFilter = () => {
    filters.value.push(placeholderFilter)
  }

  const addFilterGroup = async () => {
    const child = placeholderFilter
    const placeHolderGroupFilter: Filter = {
      is_group: true,
      status: 'create',
      logical_op: 'and',
    }
    if (isPublic.value) placeHolderGroupFilter.children = [child]

    filters.value.push(placeHolderGroupFilter)
    const index = filters.value.length - 1
    await saveOrUpdate(filters.value[index], index, true)
  }

  /** on column delete reload filters, identify by checking columns count */
  watch(
    () => {
      if (!view?.value || !metas?.value?.[view?.value?.fk_model_id as string]) {
        return 0
      }

      return metas?.value?.[view?.value?.fk_model_id as string]?.columns?.length || 0
    },
    async (nextColsLength, oldColsLength) => {
      if (nextColsLength < oldColsLength) {
        await loadFilters()
      }
    },
  )

  return { filters, loadFilters, sync, deleteFilter, saveOrUpdate, addFilter, addFilterGroup }
}
