<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import { CommonAggregations, UITypes, dateFormats, parseStringDateTime, timeFormats } from 'nocodb-sdk'
import Table from './Table.vue'
import GroupBy from './GroupBy.vue'
import GroupByTable from './GroupByTable.vue'
import GroupByLabel from './GroupByLabel.vue'
import type { Group } from '~/lib/types'

const props = defineProps<{
  group: Group

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
  loadGroupAggregation: (
    group: Group,
    fields?: Array<{
      field: string
      type: string
    }>,
  ) => Promise<void>
  redistributeRows?: (group?: Group) => void

  viewWidth?: number
  scrollLeft?: number
  fullPage?: boolean

  depth?: number
  maxDepth?: number

  rowHeight?: number
  expandForm?: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void
}>()

const emits = defineEmits(['update:paginationData'])

const vGroup = useVModel(props, 'group', emits)

const meta = inject(MetaInj, ref())

const fields = inject(FieldsInj, ref())

const scrollLeft = toRef(props, 'scrollLeft')

const { isViewDataLoading, isPaginationLoading } = storeToRefs(useViewsStore())

const { gridViewCols } = useViewColumnsOrThrow()

const reloadAggregate = inject(ReloadAggregateHookInj, createEventHook())

const displayField = computed(() => {
  return meta.value?.columns?.find((c) => c.pv)
})

const viewDisplayField = computed(() => {
  if (!displayField.value || !displayField.value.id)
    return {
      width: '100px',
    }
  return gridViewCols.value[displayField.value.id]
})

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

reloadAggregate?.on(async (_fields) => {
  if (!fields.value?.length) return
  if (!_fields || !_fields?.fields.length) {
    await props.loadGroupAggregation(vGroup.value)
  }
  if (_fields?.fields) {
    const fieldAggregateMapping = _fields.fields.reduce((acc, field) => {
      const f = fields.value.find((f) => f.title === field.title)

      if (!f?.id) return acc

      acc[f.id] = field.aggregation ?? gridViewCols.value[f.id].aggregation ?? CommonAggregations.None

      return acc
    }, {} as Record<string, string>)

    await props.loadGroupAggregation(
      vGroup.value,
      Object.entries(fieldAggregateMapping).map(([field, type]) => ({
        field,
        type,
      })),
    )
  }
})

const _loadGroupData = async (group: Group, force?: boolean, params?: any) => {
  isViewDataLoading.value = true
  isPaginationLoading.value = true

  await props.loadGroupData(group, force, params)

  isViewDataLoading.value = false
  isPaginationLoading.value = false
}

const _depth = props.depth ?? 0

const wrapper = ref<HTMLElement | undefined>()

const scrollable = ref<HTMLElement | undefined>()

const tableHeader = ref<HTMLElement | undefined>()

const fullPage = computed<boolean>(() => {
  return props.fullPage ?? (tableHeader.value?.offsetWidth ?? 0) > (props.viewWidth ?? 0)
})

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

const findAndLoadSubGroup = async (key: any) => {
  key = Array.isArray(key) ? key : [key]
  if (key.length > 0 && vGroup.value.children) {
    if (!oldActiveGroups.value.includes(key[key.length - 1])) {
      // wait until children loads since it may be still loading in background
      // todo: implement a better way to handle this
      await until(() => vGroup.value.children?.length > 0).toBeTruthy({
        timeout: 10000,
      })

      const k = key[key.length - 1].replace('group-panel-', '')
      const grp = vGroup.value.children.find((g) => `${g.key}` === k)
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

const reloadViewDataHandler = (params: void | { shouldShowLoading?: boolean | undefined; offset?: number | undefined }) => {
  if (vGroup.value.nested) {
    props.loadGroups({ ...(params?.offset !== undefined ? { offset: params.offset } : {}) }, vGroup.value)
  } else {
    _loadGroupData(vGroup.value, true, {
      ...(params?.offset !== undefined ? { offset: params.offset } : {}),
    })
    props.loadGroupAggregation(vGroup.value)
  }
}

onMounted(async () => {
  reloadViewDataHook?.on(reloadViewDataHandler)
})

onBeforeUnmount(async () => {
  reloadViewDataHook?.off(reloadViewDataHandler)
})

watch([() => vGroup.value.key], async (n, o) => {
  if (n !== o) {
    if (!vGroup.value.nested) {
      await _loadGroupData(vGroup.value, true)
    } else if (vGroup.value.nested) {
      await props.loadGroups({}, vGroup.value)
    }
  }
})

onMounted(async () => {
  if (vGroup.value.root === true && !vGroup.value?.children?.length) {
    await props.loadGroups({}, vGroup.value)
  }
})

if (vGroup.value.root === true) provide(ScrollParentInj, wrapper)

const _scrollLeft = ref<number>()
const scrollBump = computed<number>(() => {
  if (vGroup.value.root === true) {
    return _scrollLeft.value ?? 0
  } else {
    if (props.scrollLeft && props.viewWidth && scrollable.value) {
      const scrollWidth = scrollable.value.scrollWidth + 12 + 12
      if (props.scrollLeft + props.viewWidth + 20 > scrollWidth) {
        return scrollWidth - props.viewWidth - 20
      }
      return Math.max(Math.min(scrollWidth - props.viewWidth, (props.scrollLeft ?? 0) - 12), 0)
    }
    return 0
  }
})

const onScroll = (e: Event) => {
  if (!vGroup.value.root) return
  _scrollLeft.value = (e.target as HTMLElement).scrollLeft
}

// a method to parse group key if grouped column type is LTAR or Lookup
// in these 2 scenario it will return json array or `___` separated value
const parseKey = (group: Group) => {
  let key = group.key.toString()

  // parse json array key if it's a lookup or link to another record
  if ((key && group.column?.uidt === UITypes.Lookup) || group.column?.uidt === UITypes.LinkToAnotherRecord) {
    try {
      key = JSON.parse(key)
    } catch {
      // if parsing try to split it by `___` (for sqlite)
      return key.split('___')
    }
  }

  // show the groupBy dateTime field title format as like cell format
  if (key && group.column?.uidt === UITypes.DateTime) {
    return [
      parseStringDateTime(
        key,
        `${parseProp(group.column?.meta)?.date_format ?? dateFormats[0]} ${
          parseProp(group.column?.meta)?.time_format ?? timeFormats[0]
        }`,
      ),
    ]
  }

  // show the groupBy time field title format as like cell format
  if (key && group.column?.uidt === UITypes.Time) {
    return [parseStringDateTime(key, timeFormats[0], false)]
  }

  if (key && [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(group.column?.uidt as UITypes)) {
    try {
      const parsedKey = JSON.parse(key)
      return [parsedKey]
    } catch {
      return null
    }
  }

  return [key]
}

const shouldRenderCell = (column) =>
  [
    UITypes.Lookup,
    UITypes.Attachment,
    UITypes.Barcode,
    UITypes.QrCode,
    UITypes.Links,
    UITypes.User,
    UITypes.DateTime,
    UITypes.CreatedTime,
    UITypes.LastModifiedTime,
    UITypes.CreatedBy,
    UITypes.LongText,
    UITypes.LastModifiedBy,
  ].includes(column?.uidt)

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

const _collapseAllGroup = () => {
  _activeGroupKeys.value = []
}

const _expandAllGroup = async () => {
  _activeGroupKeys.value = vGroup.value.children?.map((g) => `group-panel-${g.key}`) ?? []

  if (vGroup.value.children) {
    await Promise.all(
      vGroup.value.children.map((g) => {
        return findAndLoadSubGroup(`group-panel-${g.key}`)
      }),
    )
  }
}

const computedWidth = computed(() => {
  // 55 is padding and margin of column header. 9 is padding of each level of nesting
  const baseValue = Number((viewDisplayField.value?.width ?? '').replace('px', '')) + 55 + props.maxDepth * 9
  const maxDepth = props.maxDepth ?? 1
  // The _scrollLeft is calculated only on root and passed down to nested groups
  const tempScrollLeft = vGroup.value.root ? _scrollLeft.value ?? 0 : scrollLeft.value ?? 0

  const getSubGroupWidth = (depth: number) => {
    switch (depth) {
      case 3:
        return `${baseValue - 18}px`
      case 2:
        return `${baseValue - 9}px`
      case 1:
      default:
        return `${baseValue}px`
    }
  }

  if (_depth === 0) {
    if (tempScrollLeft < 29) {
      // The equation is calculated on trial and error basis
      return `${baseValue + tempScrollLeft - (0.02 * (tempScrollLeft * tempScrollLeft) + 1.07 * tempScrollLeft)}px`
    }
    return getSubGroupWidth(maxDepth)
  }

  if (_depth === 1) {
    if (tempScrollLeft < 30) {
      // The equation is calculated on trial and error basis
      return `${baseValue + tempScrollLeft - 9 - (23 / 20) * tempScrollLeft}px`
    }
    return getSubGroupWidth(maxDepth)
  }

  if (_depth === 2) {
    if (tempScrollLeft <= 14) {
      // The equation is calculated on trial and error basis
      return `${baseValue + tempScrollLeft - 18 - tempScrollLeft}px`
    }
    return getSubGroupWidth(maxDepth)
  }

  // TODO: We only allow 3 levels of nesting for now
  // We only allow 3 levels of nesting for now
  // If we add support for more levels, we need to adjust the width calculation
  // for each level

  return `${baseValue}px`
})

const bgColor = computed(() => {
  if (props.maxDepth === 3) {
    switch (_depth) {
      case 2:
        return '#F9F9FA'
      case 1:
        return '#F4F4F5'
      default:
        return '#F1F1F1'
    }
  }

  if (props.maxDepth === 2) {
    switch (_depth) {
      case 1:
        return '#F9F9FA'
      default:
        return '#F4F4F5'
    }
  }

  if (props.maxDepth === 1) {
    return '#F9F9FA'
  }

  return '#F9F9FA'
})
</script>

<template>
  <div
    ref="wrapper"
    :class="{ 'overflow-y-auto': vGroup.root === true }"
    class="h-full"
    :style="`${!vGroup.root && vGroup.nested ? 'padding-left: 8px; padding-right: 8px;' : ''}`"
    @scroll="onScroll"
  >
    <div ref="scrollable" :style="`${vGroup.root === true ? 'width: fit-content' : 'width: 100%'}`">
      <div v-if="vGroup.root === true" class="flex sticky top-0 z-5">
        <div
          class="border-b-1 border-gray-200 mb-2"
          style="background-color: #f4f4f5"
          :style="{ 'padding-left': `${(maxDepth || 1) * 9}px` }"
        ></div>
        <Table ref="tableHeader" class="mb-2" :data="[]" :hide-checkbox="true" :header-only="true" />
      </div>
      <div :class="{ 'pl-2': vGroup.root === true }">
        <a-collapse
          v-model:activeKey="_activeGroupKeys"
          class="nc-group-wrapper !rounded-lg"
          :bordered="false"
          @change="findAndLoadSubGroup"
        >
          <a-collapse-panel
            v-for="grp of vGroup?.children ?? []"
            :key="`group-panel-${grp.key}`"
            class="!border-1 border-gray-300 nc-group rounded-[8px] mb-2"
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
                  :style="`width:${computedWidth};background: ${bgColor};`"
                  class="!sticky flex z-10 justify-between !h-9.8 border-r-1 !rounded-tl-[8px] group pr-2 border-gray-300 overflow-clip items-center !left-0"
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
                          :color="grp.color.split(',')[+tagIndex]"
                        >
                          <span
                            class="nc-group-value"
                            :style="{
                              'color': tinycolor.isReadable(grp.color.split(',')[+tagIndex] || '#ccc', '#fff', {
                                level: 'AA',
                                size: 'large',
                              })
                                ? '#fff'
                                : tinycolor
                                    .mostReadable(grp.color.split(',')[+tagIndex] || '#ccc', ['#0b1d05', '#fff'])
                                    .toHex8String(),
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
                          <span v-else class="text-gray-400">No mapped value</span>
                        </template>
                      </div>
                      <a-tag
                        v-else
                        :key="`panel-tag-${grp.column.id}-${grp.key}`"
                        class="!py-0 !px-[12px]"
                        :class="`${grp.column.uidt === 'SingleSelect' ? '!rounded-[12px]' : '!rounded-[6px]'}`"
                        :color="grp.color"
                      >
                        <span
                          class="nc-group-value font-semibold text-[13px]"
                          :style="{
                            color: tinycolor.isReadable(grp.color || '#ccc', '#fff', {
                              level: 'AA',
                              size: 'large',
                            })
                              ? '#fff'
                              : tinycolor.mostReadable(grp.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
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
                  <div
                    :style="`background: linear-gradient(to right, hsla(0, 0%, 97%, 0), ${bgColor} 18%);`"
                    class="flex !h-10 absolute right-0 pl-8 pr-2 items-center"
                  >
                    <div class="text-xs group-hover:hidden text-gray-500 nc-group-row-count">
                      <span>
                        {{ $t('datatype.Count') }}
                      </span>
                      <span class="text-[#374151] ml-2"> {{ grp.count }} </span>
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
                          <!--
                          <NcMenuItem @click="expandAllGroup">
                            <GeneralIcon icon="maximizeAll" />
                            Expand all
                          </NcMenuItem>
                          <NcMenuItem @click="collapseAllGroup">
                            <GeneralIcon icon="minimizeAll" />
                            Collapse all
                          </NcMenuItem>
                          -->
                        </NcMenu>
                      </template>
                    </NcDropdown>
                  </div>
                </div>
                <SmartsheetGridAggregation
                  :scroll-left="props.scrollLeft || _scrollLeft"
                  :max-depth="maxDepth"
                  :group="grp"
                  :depth="_depth"
                />
              </div>
            </template>
            <GroupByTable
              v-if="!grp.nested && grp.rows"
              :group="grp"
              :max-depth="maxDepth"
              :depth="depth"
              :load-groups="loadGroups"
              :load-group-data="_loadGroupData"
              :load-group-page="loadGroupPage"
              :group-wrapper-change-page="groupWrapperChangePage"
              :row-height="rowHeight"
              :redistribute-rows="redistributeRows"
              :pagination-fixed-size="fullPage ? props.viewWidth : undefined"
              :pagination-hide-sidebars="true"
              :scroll-left="props.scrollLeft || _scrollLeft"
              :view-width="viewWidth"
              :scrollable="scrollable"
            />
            <GroupBy
              v-else
              :group="grp"
              :load-groups="loadGroups"
              :load-group-data="_loadGroupData"
              :load-group-page="loadGroupPage"
              :group-wrapper-change-page="groupWrapperChangePage"
              :row-height="rowHeight"
              :load-group-aggregation="loadGroupAggregation"
              :redistribute-rows="redistributeRows"
              :view-width="viewWidth"
              :depth="_depth + 1"
              :max-depth="maxDepth"
              :scroll-left="scrollBump"
              :full-page="fullPage"
            />
          </a-collapse-panel>
        </a-collapse>
      </div>
    </div>
  </div>

  <LazySmartsheetGridPaginationV2
    v-if="vGroup.root"
    v-model:pagination-data="vGroup.paginationData"
    :show-size-changer="false"
    :scroll-left="_scrollLeft"
    custom-label="groups"
    :depth="maxDepth"
    :change-page="(p: number) => groupWrapperChangePage(p, vGroup)"
  />

  <LazySmartsheetPagination
    v-else
    v-model:pagination-data="vGroup.paginationData"
    align-count-on-right
    custom-label="groups"
    align-left
    show-api-timing
    :change-page="(p: number) => groupWrapperChangePage(p, vGroup)"
    :hide-sidebars="true"
    :style="`${
      props.depth && props.depth > 0
        ? 'border-radius: 0 0 8px 8px !important; background: transparent; border-top: 0px; height: 24px; padding-bottom: 8px;'
        : ''
    }`"
    :fixed-size="undefined"
  ></LazySmartsheetPagination>
</template>

<style scoped lang="scss">
:deep(.ant-collapse-content > .ant-collapse-content-box) {
  padding: 0px !important;
  border-radius: 0 0 8px 8px !important;
}
:deep(.ant-collapse) {
  @apply !border-gray-300 !bg-transparent;
}

:deep(.ant-collapse-item) {
  @apply !border-gray-300;
}

:deep(.ant-collapse-header) {
  @apply !p-0 !border-gray-300 !rounded-lg;
}
:deep(.ant-collapse-item-active > .ant-collapse-header) {
  border-radius: 8px 8px 0 0 !important;
}

:deep(.ant-collapse-borderless > .ant-collapse-item:last-child) {
  border-radius: 8px !important;
}
</style>
