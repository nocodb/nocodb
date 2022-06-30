<template>
  <div>
    <TabMenu :model="tabItems" v-model:activeIndex="activeIndex"/>
    <template v-if="tabItems && tabItems[activeIndex]">
     <TabsSmartsheet :tab-meta="tabs[activeIndex]" :key="tabs[activeIndex].id"/>
    </template>
  </div>
</template>

<script setup lang="ts">

import {useTabs} from "~/composables/tabs";

const {tabs} = useTabs()
const activeIndex = ref(0)

const tabItems = computed(() => {
  return tabs.value.map(tab => {
    return {
      label: tab.title,
      // icon: tab.icon,
      closable: true
    }
  })
})

</script>

<style scoped>

</style>
