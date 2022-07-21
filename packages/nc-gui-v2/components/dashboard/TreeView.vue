<script setup lang="ts">
import useProject from "~/composables/useProject";
import useTabs from "~/composables/useTabs";
import MdiSettingIcon from "~icons/mdi/cog";
import MdiTable from "~icons/mdi/table";
import MdiTableLarge from "~icons/mdi/table-large";
import MdiMenuDown from "~icons/mdi/chevron-down";
import MdiPlus from "~icons/mdi/plus-circle-outline";
import MdiDrag from "~icons/mdi/drag-vertical";
import MdiMenuIcon from "~icons/mdi/dots-vertical";

const { tables } = useProject()
const { addTab } = useTabs()

const settingsDlg = ref(false);
const showTableList = ref(true);
</script>

<template>
  <div class="nc-treeview-container flex flex-column">
    <div class="p-1">
      <a-input-search :placeholder="$t('placeholder.searchProjectTree')" />
    </div>

    <div class="p-1 flex-1 overflow-y-auto flex flex-column">
      <div class="p-1 flex w-full align-center gap-1" @click="showTableList = !showTableList">
        <MdiTable class="mr-1 text-gray-500" />
        <span class="flex-grow">{{ $t("objects.tables") }}</span>
        <MdiPlus />
        <MdiMenuDown />
      </div>
      <div class="flex-1">
        <div class="transition-height duration-200 overflow-hidden"
             :class="{'h-100':showTableList,'h-0':!showTableList}">
          <a-menu class="border-none">
            <a-menu-item
              v-for="table in tables"
              :key="table.id"
              class="!pl-1 py-1 !h-[28px] !my-0 text-sm pointer group"
              @click="addTab({ type: 'table', title: table.title, id: table.id })"
            >
              <div class="flex align-center gap-1 ">
                <MdiDrag class="transition-opacity opacity-0 group-hover:opacity-100 text-gray-500" />
                <MdiTableLarge class="text-xs text-gray-500" />

                <span class="text-sm flex-1">{{ table.title }}</span>
                <a-dropdown :trigger="['click']">
                  <MdiMenuIcon class="transition-opacity opacity-0 group-hover:opacity-100" />
                  <template #overlay>
                    <a-menu>
                      <a-menu-item>
                        Rename
                      </a-menu-item>
                      <a-menu-item>
                        UI ACL
                      </a-menu-item>
                      <a-menu-item>
                        Delete
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </div>
            </a-menu-item>
          </a-menu>
        </div>
      </div>
    </div>

    <!--    <a-menu class="flex-1 overflow-y-auto">
      <a-menu-item
        v-for="table in tables"
        :key="table.id"
        class="p-2 text-sm pointer"
        @click="addTab({ type: 'table', title: table.title, id: table.id })"
      >
        {{ table.title }}
      </a-menu-item>
    </a-menu> -->
    <div class="cursor-pointer nc-team-settings pa-4 flex align-center hover:bg-gray-200/20"
         @click="settingsDlg = true">
      <MdiSettingIcon class="mr-2" />
      <span> {{ $t("title.teamAndSettings") }}</span>
    </div>

    <a-modal v-model:visible="settingsDlg" width="max(90vw, 600px)"> Team and settings</a-modal>
  </div>
</template>

<style scoped>
.pointer {
  cursor: pointer;
}

.nc-treeview-container {
  height: calc(100vh - var(--header-height));
}
</style>
