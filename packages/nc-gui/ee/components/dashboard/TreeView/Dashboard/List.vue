<script setup lang="ts">
import Sortable from 'sortablejs'
import { type SortableEvent } from 'sortablejs'
import { type DashboardType } from 'nocodb-sdk'
import type { Menu as AntMenu } from 'ant-design-vue/lib/components'

const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { $e } = useNuxtApp()

const { addUndo, defineModelScope } = useUndoRedo()

const { isMobileMode } = useGlobal()

const bases = useBases()

const { isUIAllowed } = useRoles()

const { isSharedBase } = storeToRefs(useBase())

const { baseHomeSearchQuery, openedProject } = storeToRefs(bases)

const dashboardStore = useDashboardStore()

const { updateDashboard, openNewDashboardModal } = dashboardStore

const { activeDashboardId, dashboards: baseDashboards } = storeToRefs(dashboardStore)

const dashboards = computed(() => baseDashboards.value.get(baseId.value) ?? [])

let sortable: Sortable

const selected = ref<string[]>([])

const dragging = ref(false)

function onSortStart(evt: SortableEvent) {
  evt.stopImmediatePropagation()
  evt.preventDefault()
  dragging.value = true
}
async function onSortEnd(evt: SortableEvent, undo = false) {
  if (!undo) {
    evt.stopImmediatePropagation()
    evt.preventDefault()
    dragging.value = false
  }

  if (dashboards.value.length < 2) return

  let { newIndex = 0, oldIndex = 0 } = evt

  newIndex = newIndex - 1
  oldIndex = oldIndex - 1

  if (newIndex === oldIndex) return

  if (!undo) {
    addUndo({
      redo: {
        fn: async () => {
          const ord = sortable.toArray()
          const temp = ord.splice(oldIndex, 1)
          ord.splice(newIndex, 0, temp[0])
          sortable.sort(ord)
          await onSortEnd(evt, true)
        },
        args: [],
      },
      undo: {
        fn: async () => {
          const ord = sortable.toArray()
          const temp = ord.splice(newIndex, 1)
          ord.splice(oldIndex, 0, temp[0])
          sortable.sort(ord)
          await onSortEnd({ ...evt, oldIndex: newIndex, newIndex: oldIndex }, true)
        },
        args: [],
      },
      scope: defineModelScope({ view: activeDashboardId.value }),
    })
  }

  const children = Array.from(evt.to.children as unknown as HTMLLIElement[])

  // remove `Create View` children from list
  children.shift()

  const previousEl = children[newIndex - 1]
  const nextEl = children[newIndex + 1]

  const currentItem = dashboards.value.find((v) => v.id === evt.item.id)

  if (!currentItem || !currentItem.id) return

  // set default order value as 0 if item not found
  const previousItem = (
    previousEl ? dashboards.value.find((v) => v.id === previousEl.id) ?? { order: 0 } : { order: 0 }
  ) as DashboardType
  const nextItem = (nextEl ? dashboards.value.find((v) => v.id === nextEl.id) : {}) as DashboardType

  let nextOrder: number

  // set new order value based on the new order of the items
  if (dashboards.value.length - 1 === newIndex) {
    nextOrder = parseFloat(String(previousItem.order)) + 1
  } else if (newIndex === 0) {
    nextOrder = parseFloat(String(nextItem.order)) / 2
  } else {
    nextOrder = (parseFloat(String(previousItem.order)) + parseFloat(String(nextItem.order))) / 2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  currentItem.order = _nextOrder

  await updateDashboard(baseId.value, currentItem.id, {
    order: _nextOrder,
  })

  markItem(currentItem.id)

  $e('a:dashboard:reorder')
}

const isMarked = ref<string | false>(false)

/** shortly mark an item after sorting */
function markItem(id: string) {
  isMarked.value = id
  setTimeout(() => {
    isMarked.value = false
  }, 300)
}

const menuRef = ref<typeof AntMenu>()

const initSortable = (el: HTMLElement) => {
  if (sortable) sortable.destroy()
  if (isMobileMode.value) return

  sortable = new Sortable(el, {
    ghostClass: 'ghost',
    onStart: onSortStart,
    onEnd: onSortEnd,
  })
}

onMounted(() => {
  if (isUIAllowed('dashboardEdit') && menuRef.value) {
    initSortable(menuRef.value.$el)
  }
})

const filteredDashboards = computed(() => {
  return dashboards.value.filter((dashboard) => searchCompare(dashboard.title, baseHomeSearchQuery.value))
})
</script>

<template>
  <a-menu
    ref="menuRef"
    :class="{ dragging }"
    :selected-keys="selected"
    class="nc-dashboards-menu flex flex-col w-full !border-r-0 !bg-inherit"
  >
    <template v-if="!dashboards?.length && !isSharedBase && isUIAllowed('dashboardCreate')">
      <div @click="openNewDashboardModal({ baseId })">
        <div
          :class="{
            'text-nc-content-brand hover:text-nc-content-brand-disabled': openedProject?.id === baseId,
            'text-nc-content-gray-muted hover:text-nc-content-brand': openedProject?.id !== baseId,
          }"
          class="nc-create-dashboard-btn flex flex-row items-center cursor-pointer rounded-md w-full"
          role="button"
        >
          <div class="nc-project-home-section-item">
            <GeneralIcon icon="plus" />
            <div>
              {{
                $t('general.createEntity', {
                  entity: $t('objects.dashboard'),
                })
              }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <div
      v-if="!dashboards?.length || !filteredDashboards.length"
      class="nc-project-home-section-item text-nc-content-gray-muted font-normal"
    >
      {{
        dashboards?.length && !filteredDashboards.length
          ? $t('placeholder.noResultsFoundForYourSearch')
          : $t('placeholder.noDashboards')
      }}
    </div>
    <DashboardTreeViewDashboardNode
      v-for="dashboard of filteredDashboards"
      :id="dashboard.id"
      :key="dashboard.id"
      class="nc-dashboard-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
      :class="{
        'bg-nc-bg-gray-medium': isMarked === dashboard.id,
        'active': activeDashboardId === dashboard.id,
      }"
      :dashboard="dashboard"
    />
  </a-menu>
</template>

<style lang="scss">
.nc-dashboards-menu {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  &.dragging {
    .nc-icon {
      @apply !hidden;
    }

    .nc-view-icon {
      @apply !block;
    }
  }

  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition;
  }

  .ant-menu-title-content {
    @apply !w-full;
  }

  .sortable-chosen {
    @apply !bg-nc-bg-gray-medium;
  }

  .active {
    @apply !bg-primary-selected font-medium;
  }
}
</style>
