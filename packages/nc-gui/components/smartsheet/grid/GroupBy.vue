<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import Table from './Table.vue'
import GroupBy from './GroupBy.vue'
import GroupByTable from './GroupByTable.vue'
import { computed, ref } from '#imports'
import type { Group, Row } from '~/lib'

const props = defineProps<{
  group: Group

  loadGroups: (params?: any, group?: Group) => Promise<void>
  loadGroupData: (group: Group, force?: boolean) => Promise<void>
  loadGroupPage: (group: Group, p: number) => Promise<void>
  groupWrapperChangePage: (page: number, groupWrapper?: Group) => Promise<void>

  redistributeRows?: (group?: Group) => void

  depth?: number
  maxDepth?: number

  rowHeight?: number
  expandForm?: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void
}>()

const emits = defineEmits(['update:paginationData'])

const vGroup = useVModel(props, 'group', emits)

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

const _depth = props.depth ?? 0

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

const findAndLoadSubGroup = (key: any) => {
  key = Array.isArray(key) ? key : [key]
  if (key.length > 0 && vGroup.value.children) {
    if (!oldActiveGroups.value.includes(key[key.length - 1])) {
      const k = key[key.length - 1].replace('group-panel-', '')
      const grp = vGroup.value.children[k]
      if (grp) {
        if (grp.nested) {
          if (!grp.children?.length) props.loadGroups({}, grp)
        } else {
          if (!grp.rows?.length) props.loadGroupData(grp)
        }
      }
    }
  }
  oldActiveGroups.value = key
}

const reloadViewDataHandler = () => {
  if (vGroup.value.nested) {
    _activeGroupKeys.value = []
    oldActiveGroups.value = []
    props.loadGroups({}, vGroup.value)
  } else {
    _activeGroupKeys.value = []
    oldActiveGroups.value = []
    props.loadGroupData(vGroup.value, true)
  }
}

onBeforeUnmount(async () => {
  reloadViewDataHook?.off(reloadViewDataHandler)
})

reloadViewDataHook?.on(reloadViewDataHandler)
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-auto">
    <div class="flex flex-col my-2 h-full" :style="`${vGroup.root === true ? 'width: fit-content' : 'width: 100%'}`">
      <div v-if="vGroup.root === true" class="flex">
        <div
          class="bumper mb-2"
          style="background-color: rgb(252, 252, 252); border-color: rgb(242, 244, 247); border-bottom-width: 1px"
          :style="{ 'padding-left': `${(maxDepth || 1) * 16}px` }"
        ></div>
        <Table class="mb-2" :data="[]" :header-only="true" />
      </div>
      <a-collapse
        v-model:activeKey="_activeGroupKeys"
        class="!bg-transparent w-full"
        :bordered="false"
        @change="findAndLoadSubGroup"
      >
        <a-collapse-panel
          v-for="[i, grp] of Object.entries(vGroup?.children ?? [])"
          :key="`group-panel-${i}`"
          class="!border-0 rounded-md mb-4"
          :class="{ 'ml-[12px]': vGroup.root === true }"
          :style="`background: rgb(${245 - _depth * 10}, ${245 - _depth * 10}, ${245 - _depth * 10})`"
          :show-arrow="false"
        >
          <template #header>
            <div class="flex !sticky left-[15px]">
              <div>
                <span role="img" aria-label="right" class="anticon anticon-right ant-collapse-arrow">
                  <svg
                    focusable="false"
                    data-icon="right"
                    width="1em"
                    height="1em"
                    fill="currentColor"
                    aria-hidden="true"
                    viewBox="64 64 896 896"
                    :style="`${activeGroups.includes(i) ? 'transform: rotate(90deg)' : ''}`"
                  >
                    <path
                      d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z"
                    ></path>
                  </svg>
                </span>
              </div>
              <div class="flex items-center">
                <div class="flex flex-col">
                  <div class="flex gap-2">
                    <div class="text-xs">{{ grp.column.column_name }}</div>
                    <div class="text-xs text-gray-400">(Count: {{ grp.count }})</div>
                  </div>
                  <div class="flex mt-1">
                    <template v-if="grp.column.uidt === 'MultiSelect'">
                      <a-tag
                        v-for="[tagIndex, tag] of Object.entries(grp.key.split(','))"
                        :key="`panel-tag-${grp.column.id}-${tag}`"
                        class="!py-0 !px-[12px] !rounded-[12px]"
                        :color="grp.color.split(',')[+tagIndex]"
                      >
                        <span
                          :style="{
                            'color': tinycolor.isReadable(grp.color.split(',')[+tagIndex] || '#ccc', '#fff', {
                              level: 'AA',
                              size: 'large',
                            })
                              ? '#fff'
                              : tinycolor
                                  .mostReadable(grp.color.split(',')[+tagIndex] || '#ccc', ['#0b1d05', '#fff'])
                                  .toHex8String(),
                            'font-size': '13px',
                          }"
                        >
                          {{ tag === '__nc_null__' ? 'Empty' : tag }}
                        </span>
                      </a-tag>
                    </template>
                    <a-tag
                      v-else
                      :key="`panel-tag-${grp.column.id}-${grp.key}`"
                      class="!py-0 !px-[12px]"
                      :class="`${grp.column.uidt === 'SingleSelect' ? '!rounded-[12px]' : '!rounded-[6px]'}`"
                      :color="grp.color"
                    >
                      <span
                        :style="{
                          'color': tinycolor.isReadable(grp.color || '#ccc', '#fff', {
                            level: 'AA',
                            size: 'large',
                          })
                            ? '#fff'
                            : tinycolor.mostReadable(grp.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                          'font-size': '13px',
                        }"
                      >
                        {{ grp.key === '__nc_null__' ? 'Empty' : grp.key }}
                      </span>
                    </a-tag>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <GroupByTable
            v-if="!grp.nested && grp.rows"
            :group="grp"
            :load-groups="loadGroups"
            :load-group-data="loadGroupData"
            :load-group-page="loadGroupPage"
            :group-wrapper-change-page="groupWrapperChangePage"
            :row-height="rowHeight"
            :redistribute-rows="redistributeRows"
            :expand-form="expandForm"
          />
          <GroupBy
            v-else
            :group="grp"
            :load-groups="props.loadGroups"
            :load-group-data="props.loadGroupData"
            :load-group-page="props.loadGroupPage"
            :group-wrapper-change-page="props.groupWrapperChangePage"
            :depth="_depth + 1"
            :expand-form="props.expandForm"
            :row-height="props.rowHeight"
          />
        </a-collapse-panel>
      </a-collapse>
    </div>
    <LazySmartsheetPagination
      v-model:pagination-data="vGroup.paginationData"
      align-count-on-right
      custom-label="groups"
      :change-page="(p: number) => groupWrapperChangePage(p, vGroup)"
      :hide-sidebars="vGroup.root !== true"
    >
      <!--
        <template #add-record>
        <div v-if="isAddingEmptyRowAllowed" class="flex ml-2">
          <a-button @click="onNewRecordToFormClick()">
            <div class="flex items-center px-2 text-gray-600 hover:text-black">
              <span>New Record</span>
            </div>
          </a-button>
        </div>
      </template>
      -->
    </LazySmartsheetPagination>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-collapse-content > .ant-collapse-content-box) {
  padding: 12px !important;
}
</style>
