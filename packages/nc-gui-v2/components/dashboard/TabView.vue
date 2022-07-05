<script setup lang="ts">
import { useTabs } from '~/composables/tabs'

const { tabs, activeTab } = useTabs()
</script>

<template>
  <div>
    <v-tabs v-model="activeTab" density="compact">
      <v-tab v-for="(tab, i) in tabs" :key="i" :value="i">
        {{ tab.title }}
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
