<script setup lang="ts">
import { useProject } from '~/composables/project'
import { useTabs } from '~/composables/tabs'

const { tables } = useProject()
const { addTab } = useTabs()
</script>

<template>
  <div>
    <v-list density="medium">
      <v-list-item
        v-for="table in tables"
        :key="table.id"
        class="p-2 text-sm pointer"
        @click="addTab({ type: 'table', title: table.title, id: table.id })"
      >
        {{ table.title }}
      </v-list-item>
    </v-list>
  </div>
</template>

<style scoped>
.pointer {
  cursor: pointer;
}
</style>
