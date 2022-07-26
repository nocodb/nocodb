<script setup lang="ts">
import useTabs from '~/composables/useTabs'
import MdiCloseIcon from '~icons/mdi/close'
import MdiPlusIcon from '~icons/mdi/plus'

const { tabs, activeTab, closeTab } = useTabs()
const tableCreateDialog = ref(false)
</script>

<template>
  <div>
    <v-tabs v-model="activeTab" height="32" density="compact" color="primary">
      <v-tab v-for="(tab, i) in tabs" :key="i" :value="i" :class="`text-capitalize nc-tab-${tab.title}`">
        {{ tab.title }}
        <MdiCloseIcon class="ml-2 text-gray-500/50 mdi-close" @click.stop="closeTab(i)"></MdiCloseIcon>
      </v-tab>
      <MdiPlusIcon @click="tableCreateDialog = true" />
      <DlgTableCreate v-if="tableCreateDialog" v-model="tableCreateDialog" />
    </v-tabs>

    <v-window v-model="activeTab">
      <v-window-item v-for="(tab, i) in tabs" :key="i" :value="i">
        <TabsAuth v-if="tab.type === 'auth'" :tab-meta="tab" />
        <TabsSmartsheet v-else :tab-meta="tab" />
      </v-window-item>
    </v-window>
  </div>
</template>

<style scoped></style>
