<template>
  <div>

    <v-list density="medium">
    <v-list-item v-for="table in tables" class="p-2 text-sm pointer"
         @click="addTab({type:'table',title:table.title, id:table.id})">
      {{ table.title }}
    </v-list-item>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import {useProject} from "~/composables/project";
import {useTabs} from "~/composables/tabs";

const {tables} = useProject()
const {addTab} = useTabs()
</script>

<style scoped>
.pointer{
  cursor: pointer;
}
</style>
