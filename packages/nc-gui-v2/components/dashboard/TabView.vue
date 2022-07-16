<template>
  <div>
    <!--    <TabMenu :model="tabItems" v-model:activeIndex="activeTab"/>
        <template v-if="tabItems && tabItems[activeTab]">
         <TabsSmartsheet :tab-meta="tabs[activeTab]" :key="tabs[activeTab].id"/>
        </template>-->

    <v-tabs v-model="activeTab">

      <v-tab v-for="(tab,i) in tabs" :key="i" v-model:activeIndex="activeTab" >{{tab.title}} </v-tab>

      <v-tab-item v-for="(tab,i) in tabs" :key="i">
        <TabsSmartsheet :tab-meta="tab" />
      </v-tab-item>
    </v-tabs>
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
