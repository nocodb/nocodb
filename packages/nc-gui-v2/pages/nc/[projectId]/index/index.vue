<script setup lang="ts">
import useTabs from '~/composables/useTabs'

const { tabs, activeTab, closeTab } = useTabs()
const tableCreateDialog = ref(false)
</script>

<template>
  <div>
    <!--    <v-tabs v-model="activeTab" height="32" density="compact" color="primary">
      <v-tab v-for="(tab, i) in tabs" :key="i" :value="i" class="text-capitalize">
        {{ tab.title }}
        <MdiCloseIcon class="ml-2 text-gray-500/50" @click.stop="closeTab(i)"></MdiCloseIcon>
      </v-tab>
      <MdiPlusIcon @click="tableCreateDialog = true" />
      <DlgTableCreate v-if="tableCreateDialog" v-model="tableCreateDialog" />
    </v-tabs> -->

    <a-tabs v-model:activeKey="activeTab" size="small" type="editable-card" @edit="closeTab">
      <a-tab-pane v-for="(tab, i) in tabs" :key="i" :tab="tab.title" />
    </a-tabs>

    <NuxtPage />
    <!--    <v-window v-model="activeTab">
      <v-window-item v-for="(tab, i) in tabs" :key="i" :value="i">
        <TabsSmartsheet :tab-meta="tab" />
      </v-window-item>
    </v-window> -->
  </div>
</template>

<style scoped></style>
