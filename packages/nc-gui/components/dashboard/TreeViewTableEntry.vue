<script setup lang="ts">
import { Dropdown, Tooltip } from 'ant-design-vue'
import { Icon } from '@iconify/vue'
import type { TableType } from 'nocodb-sdk'
import type { ComputedRef, FunctionalComponent, SVGAttributes } from 'nuxt/dist/app/compat/capi'
// import { useUIPermission } from '#imports'

const props = defineProps<{
  modelValue: TableType
  setMenuContext: (type: 'table' | 'main', value?: any) => void
  icon: (table: TableType) => FunctionalComponent<SVGAttributes, {}> | undefined
  setIcon: (icon: string, table: TableType) => Promise<void>
  activeTable: ComputedRef<string | null | undefined>
  openRenameTableDialog: (table: TableType, baseId?: string | undefined, rightClick?: boolean) => void
  addTableTab: (table: TableType) => void
}>()

const table = useVModel(props, 'modelValue') // , emits)

const { deleteTable } = useTable()
// const { views, loadViews, isLoading } = useViews(table)
const { views } = useViews(table)

// onMounted(async () => {
//   await loadViews()
//   loadViews()
// })

// const emits = defineEmits(['update:modelValue'])

// const { bases, isSharedBase } = useProject()
const { isUIAllowed } = useUIPermission()
</script>

<template>
  <div>
    <div
      :key="table.id"
      v-e="['a:table:open']"
      :data-order="table.order"
      :data-id="table.id"
      :data-testid="`tree-view-table-${table.title}`"
    >
      <GeneralTooltip class="pl-2 pr-3 py-2" modifier-key="Alt">
        <template #title>{{ table.table_name }}</template>
        <div
          class="flex items-center gap-2 h-full cursor-pointer"
          @contextmenu="setMenuContext('table', table)"
          @click="addTableTab(table)"
        >
          <div class="flex w-auto" :data-testid="`tree-view-table-draggable-handle-${table.title}`">
            <component
              :is="isUIAllowed('tableIconCustomisation') ? Dropdown : 'div'"
              trigger="click"
              destroy-popup-on-hide
              class="flex items-center"
              @click.stop
            >
              <div class="flex items-center" @click.stop>
                <!-- <div>views: {{ JSON.stringify(views) }}</div> -->
                <component :is="isUIAllowed('tableIconCustomisation') ? Tooltip : 'div'">
                  <span v-if="table.meta?.icon" :key="table.meta?.icon" class="nc-table-icon flex items-center">
                    <Icon
                      :key="table.meta?.icon"
                      :data-testid="`nc-icon-${table.meta?.icon}`"
                      class="text-xl"
                      :icon="table.meta?.icon"
                    ></Icon>
                  </span>
                  <component
                    :is="icon(table)"
                    v-else
                    class="nc-table-icon nc-view-icon w-5"
                    :class="{ 'group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop') }"
                  />

                  <template v-if="isUIAllowed('tableIconCustomisation')" #title>Change icon</template>
                </component>
              </div>
              <template v-if="isUIAllowed('tableIconCustomisation')" #overlay>
                <GeneralEmojiIcons class="shadow bg-white p-2" @select-icon="setIcon($event, table)" />
              </template>
            </component>
          </div>

          <div class="nc-tbl-title flex-1">
            <GeneralTruncateText :key="table.title" :length="activeTable === table.id ? 18 : 20">{{
              table.title
            }}</GeneralTruncateText>
          </div>

          <a-dropdown
            v-if="!isSharedBase && (isUIAllowed('table-rename') || isUIAllowed('table-delete'))"
            :trigger="['click']"
            @click.stop
          >
            <MdiDotsVertical class="transition-opacity opacity-0 group-hover:opacity-100 outline-0" />

            <template #overlay>
              <a-menu class="!py-0 rounded text-sm">
                <a-menu-item v-if="isUIAllowed('table-rename')" @click="openRenameTableDialog(table, bases[0].id)">
                  <div class="nc-project-menu-item" :data-testid="`sidebar-table-rename-${table.title}`">
                    {{ $t('general.rename') }}
                  </div>
                </a-menu-item>

                <a-menu-item
                  v-if="isUIAllowed('table-delete')"
                  :data-testid="`sidebar-table-delete-${table.title}`"
                  @click="deleteTable(table)"
                >
                  <div class="nc-project-menu-item">
                    {{ $t('general.delete') }}
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </GeneralTooltip>
    </div>
    <ul :style="{ marginLeft: '30px' }">
      <li v-for="(view, idx) of views" :key="idx">
        <LazyGeneralTruncateText>{{ view.title }}</LazyGeneralTruncateText>
        <GeneralViewIcon :meta="view" class="nc-view-icon"></GeneralViewIcon>
        <div class="flex-1" />
        <!-- <div class="flex items-center gap-1" :data-testid="`view-sidebar-view-actions-${view.title}`">
        </div> -->
        <!-- <div v-e="['a:view:open', { view: view.type }]" class="text-xs flex items-center w-full gap-2" data-testid="view-item">
          <div class="flex w-auto min-w-5" :data-testid="`view-sidebar-drag-handle-${view.alias || view.title}`">
            <a-dropdown :trigger="['click']" @click.stop>
              <component :is="isUIAllowed('viewIconCustomisation') ? Tooltip : 'div'">
                <GeneralViewIcon :meta="table" class="nc-view-icon"></GeneralViewIcon>
              </component>

              <template v-if="isUIAllowed('viewIconCustomisation')" #overlay>
                <GeneralEmojiIcons class="shadow bg-white p-2" />
              </template>
            </a-dropdown>
          </div>


          <div class="flex-1" />
        </div> -->
      </li>
    </ul>
  </div>
</template>
