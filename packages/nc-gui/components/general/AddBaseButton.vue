<script setup lang="ts">
import { useUIPermission } from '#imports'

const { isUIAllowed } = useUIPermission()

const toggleDialog = inject(ToggleDialogInj, () => {})
</script>

<template>
  <div
    class="flex items-center w-full pl-3 hover:(text-primary bg-primary bg-opacity-5)"
    @click="toggleDialog(true, 'dataSources', 'New')"
  >
    <div v-if="isUIAllowed('newBase')">
      <div class="flex items-center space-x-1">
        <MdiDatabasePlusOutline class="mr-1 nc-new-base" />
        <div>Data Sources</div>
      </div>
    </div>
  </div>
</template>
