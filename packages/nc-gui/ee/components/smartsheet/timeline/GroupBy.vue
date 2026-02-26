<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import dayjs from 'dayjs'
import type { Row as RowType } from '#imports'
import { shouldRenderCell } from '../../../utils/groupbyUtils'
import GroupBy from './GroupBy.vue'
import GroupByLabel from '../grid/GroupByLabel.vue'
import type { Group } from '~/lib/types'

const props = defineProps<{
  group: Group
  visibleDates: dayjs.Dayjs[]
  timelineRange: Array<{
    fk_from_col: ColumnType
    fk_to_col?: ColumnType | null
    id: string
    is_readonly: boolean
  }>
  zoomLevel: 'day' | 'week' | 'month'
  loadGroups: (
    params?: any,
    group?: Group,
    options?: {
      triggerChildOnly?: boolean
    },
  ) => Promise<void>
  loadGroupData: (group: Group, force?: boolean, params?: any) => Promise<void>
  loadGroupPage: (group: Group, p: number) => Promise<void>
  groupWrapperChangePage: (page: number, groupWrapper?: Group) => Promise<void>
  depth?: number
  maxDepth?: number
}>()

const emit = defineEmits<{
  (event: 'expandRecord', row: RowType, state?: Record<string, any>): void
  (event: 'navigateTo', date: dayjs.Dayjs): void
}>()

const { isDark, getColor } = useTheme()

const GROUP_SIDEBAR_WIDTH = TIMELINE_GROUP_SIDEBAR_WIDTH

const _depth = props.depth ?? 0

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

const { isViewDataLoading, isPaginationLoading } = storeToRefs(useViewsStore())

// Wrapper function to manage loading state when loading group data
const _loadGroupData = async (group: Group, force?: boolean, params?: any) => {
  isViewDataLoading.value = true
  isPaginationLoading.value = true

  await props.loadGroupData(group, force, params)

  isViewDataLoading.value = false
  isPaginationLoading.value = false
}

// Wrapper function to manage loading state when loading groups
const _loadGroups = async (params?: any, group?: Group, options?: { triggerChildOnly?: boolean }) => {
  isViewDataLoading.value = true
  isPaginationLoading.value = true

  await props.loadGroups(params, group, options)

  isViewDataLoading.value = false
  isPaginationLoading.value = false
}

// Expanded groups tracker — plain object for reliable Vue reactivity
const expandedGroups = ref<Record<string, boolean>>({})
// Track keys we've already processed so we don't re-expand manually collapsed groups
const seenKeys = new Set<string>()

const isExpanded = (key: string) => !!expandedGroups.value[key]

const toggleGroup = async (grp: any) => {
  const key = String(grp.key)
  if (expandedGroups.value[key]) {
    expandedGroups.value = { ...expandedGroups.value, [key]: false }
  } else {
    expandedGroups.value = { ...expandedGroups.value, [key]: true }
    // Load data on expand if not yet loaded
    if (grp.nested) {
      if (!grp.children?.[0]?.children?.length) {
        await _loadGroups({}, grp, { triggerChildOnly: true })
      }
    } else {
      if (!grp.rows?.length) {
        await _loadGroupData(grp)
      }
    }
  }
}

// Auto-expand all groups and load data when children become available
watch(
  () => props.group?.children,
  (children) => {
    if (!children) return

    // If this is the root group, check if we have a completely new set of children
    // (different grouping configuration). If so, reset tracking state.
    if (props.group.root && children.length > 0) {
      const currentKeys = new Set(children.map((g) => String(g.key)))
      const hasNewKeys = Array.from(currentKeys).some((k) => !seenKeys.has(k))
      const hasOldKeys = Array.from(seenKeys).some((k) => !currentKeys.has(k))

      // If we have both new keys and missing old keys, this is a different grouping
      if (hasNewKeys && hasOldKeys) {
        seenKeys.clear()
        expandedGroups.value = {}
      }
    }

    let changed = false
    const updates: Record<string, boolean> = {}
    for (const grp of children) {
      const key = String(grp.key)
      // Only auto-expand groups we haven't seen before
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        updates[key] = true
        changed = true
        // Load data for leaf groups
        if (!grp.nested && !grp.rows?.length) {
          _loadGroupData(grp)
        }
        // Load sub-groups for nested groups
        if (grp.nested && !grp.children?.length) {
          _loadGroups({}, grp, { triggerChildOnly: true })
        }
      }
    }
    if (changed) {
      expandedGroups.value = { ...expandedGroups.value, ...updates }
    }
  },
  { immediate: true },
)

const reloadViewDataHandler = () => {
  if (props.group.nested) {
    _loadGroups({}, props.group)
  } else {
    _loadGroupData(props.group, true)
  }
}

onMounted(async () => {
  reloadViewDataHook?.on(reloadViewDataHandler)
})

onBeforeUnmount(async () => {
  reloadViewDataHook?.off(reloadViewDataHandler)
})

// Root auto-load: if root has no children, load groups
onMounted(async () => {
  if (props.group.root === true && !props.group?.children?.length) {
    await _loadGroups({}, props.group)
  }
})
</script>

<template>
  <div class="h-full overflow-y-auto">
    <!-- CSS Grid layout: left sidebar (group labels) + right timeline area -->
    <div
      class="nc-timeline-group-grid"
      :style="{ display: 'grid', gridTemplateColumns: `${GROUP_SIDEBAR_WIDTH}px 1fr` }"
    >
      <template v-for="grp of group?.children ?? []" :key="grp.key">
        <!-- #13: Left cell: group label — min-h matches right cell when collapsed -->
        <div
          class="nc-timeline-group-label border-b border-r border-nc-border-gray-medium px-3 py-2 bg-nc-bg-default cursor-pointer select-none hover:bg-nc-bg-gray-extralight transition-colors"
          @click="toggleGroup(grp)"
        >
          <div class="flex items-center gap-1.5 w-full">
            <GeneralIcon
              icon="chevronDown"
              class="flex-shrink-0 text-nc-content-gray-muted transition-transform"
              :class="{ '-rotate-90': !isExpanded(String(grp.key)) }"
            />

            <div class="flex items-center min-w-0 flex-1 gap-2">
              <!-- Group value rendering -->
              <template v-if="grp.column?.uidt === 'MultiSelect'">
                <div class="flex flex-wrap gap-1 min-w-0">
                  <a-tag
                    v-for="[tagIndex, tag] of Object.entries(grp.key.split(','))"
                    :key="`tag-${grp.column.id}-${tag}`"
                    class="!py-0 !px-[10px] !rounded-full !m-0"
                    :color="
                      getSelectTypeFieldOptionBgColor({
                        isDark,
                        color: grp.color?.split(',')[+tagIndex] || '#ccc',
                      })
                    "
                  >
                    <span
                      :style="{
                        color: getSelectTypeFieldOptionTextColor({
                          isDark,
                          color: grp.color?.split(',')[+tagIndex] || '#ccc',
                          getColor,
                        }),
                        fontSize: '12px',
                        fontWeight: 500,
                      }"
                    >
                      {{ tag in GROUP_BY_VARS.VAR_TITLES ? GROUP_BY_VARS.VAR_TITLES[tag] : tag }}
                    </span>
                  </a-tag>
                </div>
              </template>

              <div
                v-else-if="!(grp.key in GROUP_BY_VARS.VAR_TITLES) && shouldRenderCell(grp.column)"
                class="flex min-w-0 flex-wrap"
              >
                <template v-for="(val, ind) of parseKey(grp)" :key="ind">
                  <GroupByLabel v-if="val" :column="grp.column" :model-value="val" />
                  <span v-else class="text-nc-content-gray-muted text-sm">No mapped value</span>
                </template>
              </div>

              <a-tag
                v-else
                class="!py-0 !px-[10px] !m-0"
                :class="grp.column?.uidt === 'SingleSelect' ? '!rounded-full' : '!rounded-md'"
                :color="
                  getSelectTypeFieldOptionBgColor({
                    isDark,
                    color: grp.color || '#ccc',
                  })
                "
              >
                <span
                  class="font-semibold text-[12px]"
                  :style="{
                    color: getSelectTypeFieldOptionTextColor({
                      isDark,
                      color: grp.color || '#ccc',
                      getColor,
                    }),
                  }"
                >
                  <template v-if="grp.key in GROUP_BY_VARS.VAR_TITLES">{{ GROUP_BY_VARS.VAR_TITLES[grp.key] }}</template>
                  <template v-else>{{ parseKey(grp)?.join(', ') }}</template>
                </span>
              </a-tag>

              <!-- Record count — right-aligned -->
              <span class="text-[11px] text-nc-content-gray-muted ml-auto flex-shrink-0">
                {{ grp.count }}
              </span>
            </div>
          </div>
        </div>

        <!-- #16: Right cell: timeline content — with expand/collapse transition -->
        <div
          class="border-b border-nc-border-gray-medium overflow-hidden"
        >
          <div v-if="isExpanded(String(grp.key))">
            <!-- Leaf group: render timeline grid -->
            <SmartsheetTimelineGrid
              v-if="!grp.nested && grp.rows"
              :records="grp.rows"
              :visible-dates="visibleDates"
              :timeline-range="timelineRange"
              :zoom-level="zoomLevel"
              :hide-header="true"
              @expand-record="(row: RowType, state?: Record<string, any>) => emit('expandRecord', row, state)"
              @navigate-to="(date: dayjs.Dayjs) => emit('navigateTo', date)"
            />

            <!-- Nested group: recurse -->
            <GroupBy
              v-else-if="grp.nested"
              :group="grp"
              :visible-dates="visibleDates"
              :timeline-range="timelineRange"
              :zoom-level="zoomLevel"
              :load-groups="loadGroups"
              :load-group-data="loadGroupData"
              :load-group-page="loadGroupPage"
              :group-wrapper-change-page="groupWrapperChangePage"
              :depth="_depth + 1"
              :max-depth="maxDepth"
              @expand-record="(row: RowType, state?: Record<string, any>) => emit('expandRecord', row, state)"
              @navigate-to="(date: dayjs.Dayjs) => emit('navigateTo', date)"
            />

            <!-- Loading state -->
            <div v-else class="flex items-center justify-center py-4 text-nc-content-gray-muted">
              <GeneralLoader size="medium" />
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Pagination for root group -->
    <LazySmartsheetPagination
      v-if="group.root && group.paginationData"
      v-model:pagination-data="group.paginationData"
      align-count-on-right
      custom-label="groups"
      align-left
      show-api-timing
      :change-page="(p: number) => groupWrapperChangePage(p, group)"
      :hide-sidebars="true"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-timeline-group-label {
  align-self: stretch;
}
</style>
