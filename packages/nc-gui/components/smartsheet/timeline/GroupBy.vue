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

const _depth = props.depth ?? 0

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

const _activeGroupKeys = ref<string[] | string>()

const activeGroups = computed<string[]>(() => {
  if (!_activeGroupKeys.value) return []
  if (Array.isArray(_activeGroupKeys.value)) {
    return _activeGroupKeys.value.map((k) => k.replace('group-panel-', ''))
  } else {
    return [_activeGroupKeys.value.replace('group-panel-', '')]
  }
})

const oldActiveGroups = ref<string[]>([])

const _loadGroupData = async (group: Group, force?: boolean, params?: any) => {
  await props.loadGroupData(group, force, params)
}

const findAndLoadSubGroup = async (key: any) => {
  key = Array.isArray(key) ? key : [key]
  if (key.length > 0 && props.group.children) {
    if (!oldActiveGroups.value.includes(key[key.length - 1])) {
      await until(() => props.group.children?.length > 0).toBeTruthy({
        timeout: 10000,
      })

      const k = key[key.length - 1].replace('group-panel-', '')
      const grp = props.group.children.find((g) => `${g.key}` === k)
      if (grp) {
        if (grp.nested) {
          if (!grp.children?.[0]?.children?.length) {
            props.loadGroups({}, grp, {
              triggerChildOnly: true,
            })
          }
        } else {
          if (!grp.rows?.length) _loadGroupData(grp)
        }
      }
    }
  }
  oldActiveGroups.value = key
}

const reloadViewDataHandler = () => {
  if (props.group.nested) {
    props.loadGroups({}, props.group)
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
    await props.loadGroups({}, props.group)
  }
})

const expandGroup = async (key: string) => {
  if (Array.isArray(_activeGroupKeys.value)) {
    _activeGroupKeys.value.push(`group-panel-${key}`)
  } else {
    _activeGroupKeys.value = [`group-panel-${key}`]
  }
  await findAndLoadSubGroup(`group-panel-${key}`)
}

const collapseGroup = (key: string) => {
  if (Array.isArray(_activeGroupKeys.value)) {
    _activeGroupKeys.value = _activeGroupKeys.value.filter((k) => k !== `group-panel-${key}`)
  } else {
    _activeGroupKeys.value = []
  }
}

const bgColor = computed(() => {
  if (props.maxDepth === 3) {
    switch (_depth) {
      case 2:
        return getColor(themeV4Colors.gray['50'])
      case 1:
        return getColor(themeV4Colors.gray['100'])
      default:
        return getColor('#F1F1F1', themeV4Colors.gray['200'])
    }
  }

  if (props.maxDepth === 2) {
    switch (_depth) {
      case 1:
        return getColor(themeV4Colors.gray['50'])
      default:
        return getColor(themeV4Colors.gray['100'])
    }
  }

  if (props.maxDepth === 1) {
    return getColor(themeV4Colors.gray['50'])
  }

  return getColor(themeV4Colors.gray['50'])
})
</script>

<template>
  <div
    class="h-full overflow-y-auto"
    :style="`${!group.root && group.nested ? 'padding-left: 8px; padding-right: 8px;' : ''}`"
  >
    <div :class="{ 'pl-2 pr-2': group.root === true }">
      <a-collapse
        v-model:active-key="_activeGroupKeys"
        class="nc-timeline-group-wrapper !rounded-lg"
        :bordered="false"
        @change="findAndLoadSubGroup"
      >
        <a-collapse-panel
          v-for="grp of group?.children ?? []"
          :key="`group-panel-${grp.key}`"
          class="!border-1 border-nc-border-gray-dark nc-timeline-group rounded-[8px] mb-2"
          :style="`background: ${bgColor};`"
          :show-arrow="false"
        >
          <template #header>
            <div
              :class="{
                '!rounded-b-none': activeGroups.includes(grp.key.toString()),
                '!border-b-1': _depth === (maxDepth ?? 1) - 1 && activeGroups.includes(grp.key.toString()),
              }"
              class="flex !sticky w-full items-center rounded-b-lg select-none transition-all !rounded-t-[8px] !h-10"
            >
              <div
                :class="{
                  '!rounded-bl-[8px]': !activeGroups.includes(grp.key.toString()),
                }"
                :style="`background: ${bgColor};`"
                class="flex z-10 justify-between !h-9.8 !rounded-tl-[8px] group pr-2 overflow-clip items-center w-full"
              >
                <div class="flex items-center">
                  <NcButton class="!border-0 !shadow-none !bg-transparent !hover:bg-transparent" type="secondary" size="small">
                    <GeneralIcon
                      icon="chevronDown"
                      class="transition-all"
                      :style="`${
                        activeGroups.includes(grp.key.toString()) ? 'transform: rotate(360deg)' : 'transform: rotate(270deg)'
                      }`"
                    />
                  </NcButton>

                  <div class="flex">
                    <template v-if="grp.column.uidt === 'MultiSelect'">
                      <a-tag
                        v-for="[tagIndex, tag] of Object.entries(grp.key.split(','))"
                        :key="`panel-tag-${grp.column.id}-${tag}`"
                        class="!py-0 !px-[12px] !rounded-[12px]"
                        :color="
                          getSelectTypeFieldOptionBgColor({
                            isDark,
                            color: grp.color?.split(',')[+tagIndex] || '#ccc',
                          })
                        "
                      >
                        <span
                          class="nc-group-value"
                          :style="{
                            'color': getSelectTypeFieldOptionTextColor({
                              isDark,
                              color: grp.color?.split(',')[+tagIndex] || '#ccc',
                              getColor,
                            }),
                            'font-size': '14px',
                            'font-weight': 500,
                          }"
                        >
                          {{ tag in GROUP_BY_VARS.VAR_TITLES ? GROUP_BY_VARS.VAR_TITLES[tag] : tag }}
                        </span>
                      </a-tag>
                    </template>
                    <div
                      v-else-if="!(grp.key in GROUP_BY_VARS.VAR_TITLES) && shouldRenderCell(grp.column)"
                      class="flex min-w-[100px] flex-wrap"
                    >
                      <template v-for="(val, ind) of parseKey(grp)" :key="ind">
                        <GroupByLabel v-if="val" :column="grp.column" :model-value="val" />
                        <span v-else class="text-nc-content-gray-disabled">No mapped value</span>
                      </template>
                    </div>
                    <a-tag
                      v-else
                      :key="`panel-tag-${grp.column.id}-${grp.key}`"
                      class="!py-0 !px-[12px]"
                      :class="`${grp.column.uidt === 'SingleSelect' ? '!rounded-[12px]' : '!rounded-[6px]'}`"
                      :color="
                        getSelectTypeFieldOptionBgColor({
                          isDark,
                          color: grp.color || '#ccc',
                        })
                      "
                    >
                      <span
                        class="nc-group-value font-semibold text-[13px]"
                        :style="{
                          color: getSelectTypeFieldOptionTextColor({
                            isDark,
                            color: grp.color || '#ccc',
                            getColor,
                          }),
                        }"
                      >
                        <template v-if="grp.key in GROUP_BY_VARS.VAR_TITLES">{{ GROUP_BY_VARS.VAR_TITLES[grp.key] }}</template>
                        <template v-else>
                          {{ parseKey(grp)?.join(', ') }}
                        </template>
                      </span>
                    </a-tag>
                  </div>
                </div>

                <div class="flex items-center">
                  <div class="text-xs text-nc-content-gray-muted nc-group-row-count group-hover:hidden">
                    <span>{{ $t('datatype.Count') }}</span>
                    <span class="text-nc-content-gray-subtle ml-2">{{ grp.count }}</span>
                  </div>

                  <NcDropdown class="!hidden !group-hover:block">
                    <NcButton size="small" type="text" @click.stop>
                      <GeneralIcon icon="threeDotVertical" />
                    </NcButton>

                    <template #overlay>
                      <NcMenu variant="small">
                        <NcMenuItem v-if="activeGroups.includes(grp.key.toString())" @click="collapseGroup(grp.key)">
                          <GeneralIcon icon="minimize" />
                          Collapse group
                        </NcMenuItem>
                        <NcMenuItem v-else @click="expandGroup(grp.key)">
                          <GeneralIcon icon="maximize" />
                          Expand group
                        </NcMenuItem>
                      </NcMenu>
                    </template>
                  </NcDropdown>
                </div>
              </div>
            </div>
          </template>

          <!-- Leaf group: render timeline grid with this group's rows -->
          <SmartsheetTimelineGrid
            v-if="!grp.nested && grp.rows"
            :records="grp.rows"
            :visible-dates="visibleDates"
            :timeline-range="timelineRange"
            :zoom-level="zoomLevel"
            @expand-record="(row: RowType, state?: Record<string, any>) => emit('expandRecord', row, state)"
          />

          <!-- Nested group: recurse -->
          <GroupBy
            v-else
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
        </a-collapse-panel>
      </a-collapse>
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
:deep(.ant-collapse-content > .ant-collapse-content-box) {
  padding: 0px !important;
  border-radius: 0 0 8px 8px !important;
}
:deep(.ant-collapse) {
  @apply !border-nc-border-gray-dark !bg-transparent;
}

:deep(.ant-collapse-item) {
  @apply !border-nc-border-gray-dark;
}

:deep(.ant-collapse-header) {
  @apply !p-0 !border-nc-border-gray-dark !rounded-lg;
}
:deep(.ant-collapse-item-active > .ant-collapse-header) {
  border-radius: 8px 8px 0 0 !important;
}

:deep(.ant-collapse-borderless > .ant-collapse-item:last-child) {
  border-radius: 8px !important;
}
</style>
