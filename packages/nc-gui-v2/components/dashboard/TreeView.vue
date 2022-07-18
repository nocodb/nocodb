<script setup lang="ts">
import useProject from '~/composables/useProject'
import useTabs from '~/composables/useTabs'

const { tables } = useProject()
const { addTab } = useTabs()
</script>

<template>
  <div class="nc-treeview-container flex flex-column">
    <a-menu>
      <a-menu-item
        v-for="table in tables"
        :key="table.id"
        class="p-2 text-sm pointer"
        @click="addTab({ type: 'table', title: table.title, id: table.id })"
      >
        {{ table.title }}
      </a-menu-item>
    </a-menu>
  </div>
</template>

<style scoped>
.pointer {
  cursor: pointer;
}

.nc-treeview-container {
  height: calc(100vh - var(--header-height));
}
</style>
