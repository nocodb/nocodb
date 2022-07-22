<script setup lang="ts">
import SettingsModal from './settings/SettingsModal.vue'
import { useProject, useTabs } from '#imports'
import MdiSettingIcon from '~icons/mdi/cog'

const { tables } = useProject()
const { addTab } = useTabs()

const settingsDlg = ref(false)
</script>

<template>
  <div class="nc-treeview-container flex flex-column">
    <a-menu class="flex-1 overflow-y-auto">
      <a-menu-item
        v-for="table in tables"
        :key="table.id"
        class="p-2 text-sm pointer"
        @click="addTab({ type: 'table', title: table.title, id: table.id })"
      >
        {{ table.title }}
      </a-menu-item>
    </a-menu>
    <div class="cursor-pointer nc-team-settings pa-4 flex align-center hover:bg-gray-200/20" @click="settingsDlg = true">
      <MdiSettingIcon class="mr-2" />
      <span> {{ $t('title.teamAndSettings') }}</span>
    </div>

    <SettingsModal :show="settingsDlg" @closed="settingsDlg = false" />
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
