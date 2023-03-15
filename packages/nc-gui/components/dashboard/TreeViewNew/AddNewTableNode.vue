<script lang="ts" setup>
</script>

<template>
  <div
    v-if="projects[project.id].bases[0] && projects[project.id].bases[0].enabled"
    ref="menuRefs"
    :key="`sortable-${projects[project.id].bases[0].id}-${
      projects[project.id].bases[0].id && projects[project.id].bases[0].id in keys ? keys[projects[project.id].bases[0].id] : '0'
    }`"
    :nc-base="projects[project.id].bases[0].id"
  >
    <div
      v-for="table of (projectTableList[project.id] ?? []).filter((table) => table.base_id === projects[project.id].bases[0].id)"
      :key="table.id"
      v-e="['a:table:open']"
      :class="[
        // todo: table filter
        // { hidden: !filteredTables?.includes(table), active: activeTable === table.id },
        `nc-project-tree-tbl nc-project-tree-tbl-${table.title}`,
        { active: activeTable === table.id },
      ]"
      class="nc-tree-item text-sm cursor-pointer group"
      :data-order="table.order"
      :data-id="table.id"
      :data-testid="`tree-view-table-${table.title}`"
      @click="addTableTab(table)"
    >
      <GeneralTooltip class="pl-2 pr-3 py-2" modifier-key="Alt">
        <template #title>{{ table.table_name }}</template>
        <div class="table-context flex items-center gap-2 h-full" @contextmenu="setMenuContext('table', table)">
          <div class="flex w-auto" :data-testid="`tree-view-table-draggable-handle-${table.title}`">
            <component
              :is="isUIAllowed('tableIconCustomisation') ? Dropdown : 'div'"
              trigger="click"
              destroy-popup-on-hide
              class="flex items-center"
              @click.stop
            >
              <div class="flex items-center" @click.stop>
                <component :is="isUIAllowed('tableIconCustomisation') ? Tooltip : 'div'">
                  <span v-if="table.meta?.icon" :key="table.meta?.icon" class="nc-table-icon flex items-center">
                    <IconifyIcon
                      :key="table.meta?.icon"
                      :data-testid="`nc-icon-${table.meta?.icon}`"
                      class="text-xl"
                      :icon="table.meta?.icon"
                    ></IconifyIcon>
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
            <GeneralTruncateText :key="table.title" :length="activeTable === table.id ? 18 : 20"
              >{{ table.title }}
            </GeneralTruncateText>
          </div>

          <a-dropdown
            v-if="!isSharedBase && (isUIAllowed('table-rename') || isUIAllowed('table-delete'))"
            :trigger="['click']"
            @click.stop
          >
            <MdiDotsVertical class="transition-opacity opacity-0 group-hover:opacity-100 outline-0" />

            <template #overlay>
              <a-menu class="!py-0 rounded text-sm">
                <a-menu-item
                  v-if="isUIAllowed('table-rename')"
                  @click="openRenameTableDialog(table, projects[project.id].bases[0].id)"
                >
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
  </div>
</template>

<style scoped></style>
