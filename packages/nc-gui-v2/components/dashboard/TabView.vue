<template>
  <div>


    <v-tabs density="compact" v-model="activeTab">

      <v-tab v-for="(tab,i) in tabs" :key="i" :value="i" >{{tab.title}} </v-tab>

    </v-tabs>

    <v-window v-model="activeTab">
      <v-window-item
        v-for="(tab,i) in tabs"
        :key="i"
        :value="i"
      >
        <TabsSmartsheet :tab-meta="tab" />
      </v-window-item>
    </v-window>

  </div>
</template>

<script setup lang="ts">

import { useTabs } from "~/composables/tabs";

const { tabs, activeTab } = useTabs();

// const tabItems = computed(() => {
//   return tabs.value.map(tab => {
//     return {
//       label: tab.title,
//       // icon: tab.icon,
//       closable: true
//     }
//   })
// })

</script>

<style scoped>

</style>
