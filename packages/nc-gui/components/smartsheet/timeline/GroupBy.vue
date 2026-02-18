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
  zoomLevel: 'week' | 'month'
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
}>()

const { isDark, getColor } = useTheme()

const GROUP_SIDEBAR_WIDTH = 200

const _depth = props.depth ?? 0

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

// Expanded groups tracker — all groups expanded by default (like Airtable)
const expandedGroups = ref<Set<string>>(new Set())

const isExpanded = (key: string) => expandedGroups.value.has(key)

const toggleGroup = async (grp: any) => {
  const key = String(grp.key)
  if (expandedGroups.value.has(key)) {
    expandedGroups.value.delete(key)
  } else {
    expandedGroups.value.add(key)
    // Load data on expand if not yet loaded
    if (grp.nested) {
      if (!grp.children?.[0]?.children?.length) {
        await props.loadGroups({}, grp, { triggerChildOnly: true })
      }
    } else {
      if (!grp.rows?.length) {
        await props.loadGroupData(grp)
      }
    }
  }
}

// Auto-expand all groups and load data when children become available
watch(
  () => props.group?.children,
  (children) => {
    if (!children) return
    for (const grp of children) {
      const key = String(grp.key)
      if (!expandedGroups.value.has(key)) {
        expandedGroups.value.add(key)
        // Load data for leaf groups
        if (!grp.nested && !grp.rows?.length) {
          props.loadGroupData(grp)
        }
        // Load sub-groups for nested groups
        if (grp.nested && !grp.children?.length) {
          props.loadGroups({}, grp, { triggerChildOnly: true })
        }
      }
    }
  },
  { immediate: true },
)

const reloadViewDataHandler = () => {
  if (props.group.nested) {
    props.loadGroups({}, props.group)
  } else {
    props.loadGroupData(props.group, true)
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
    await props.loadGroups({}, props.group)
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
        <!-- Left cell: group label -->
        <div
          class="nc-timeline-group-label border-b border-r border-gray-200 px-3 py-2 bg-white cursor-pointer select-none hover:bg-gray-50/80 transition-colors"
          @click="toggleGroup(grp)"
        >
          <div class="flex items-start gap-1.5">
            <GeneralIcon
              icon="chevronDown"
              class="flex-shrink-0 mt-0.5 text-gray-400 transition-transform"
              :class="{ '-rotate-90': !isExpanded(String(grp.key)) }"
            />

            <div class="flex flex-col min-w-0 gap-1">
              <!-- Group value rendering -->
              <template v-if="grp.column?.uidt === 'MultiSelect'">
                <div class="flex flex-wrap gap-1">
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
                  <span v-else class="text-gray-400 text-sm">No mapped value</span>
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

              <!-- Record count -->
              <span class="text-[11px] text-gray-400 leading-tight">
                {{ grp.count }} record{{ grp.count !== 1 ? 's' : '' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Right cell: timeline content -->
        <div class="border-b border-gray-200" :class="{ 'min-h-[40px]': !isExpanded(String(grp.key)) }">
          <template v-if="isExpanded(String(grp.key))">
            <!-- Leaf group: render timeline grid -->
            <SmartsheetTimelineGrid
              v-if="!grp.nested && grp.rows"
              :records="grp.rows"
              :visible-dates="visibleDates"
              :timeline-range="timelineRange"
              :zoom-level="zoomLevel"
              :hide-header="true"
              @expand-record="(row: RowType, state?: Record<string, any>) => emit('expandRecord', row, state)"
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
            />

            <!-- Loading state -->
            <div v-else class="flex items-center justify-center py-4 text-gray-400">
              <GeneralLoader size="medium" />
            </div>
          </template>
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
