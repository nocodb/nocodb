<script setup lang="ts">
import useTabs from '~/composables/useTabs'
import MdiCloseIcon from '~icons/mdi/close'

const { tabs, activeTab, closeTab } = useTabs()
</script>

<template>
  <div>
    <v-tabs v-model="activeTab" height="32" density="compact" color="primary">
      <v-tab v-for="(tab, i) in tabs" :key="i" :value="i" class="text-capitalize">
        {{ tab.title }}
        <MdiCloseIcon class="ml-2 text-gray-500/50" @click.stop="closeTab(i)"></MdiCloseIcon>
      </v-tab>
    </v-tabs>

    <v-window v-model="activeTab">
      <v-window-item v-for="(tab, i) in tabs" :key="i" :value="i">
        <TabsSmartsheet :tab-meta="tab" />
      </v-window-item>
    </v-window>
  </div>
</template>

<style scoped></style>
