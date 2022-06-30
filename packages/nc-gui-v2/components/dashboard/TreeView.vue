<template>
  <div>

    <div v-for="table in tables" class="p-2 text-sm"
         @click="addTab({type:'table',title:table.title, id:table.id})">
      {{ table.title }}
    </div>

  </div>
</template>

<script setup lang="ts">
import {useProject} from "~/composables/project";
import {useTabs} from "~/composables/tabs";

const {tables} = useProject()
const {addTab} = useTabs()
</script>

<style scoped>

</style>
