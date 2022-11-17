<script setup lang="ts">
import { CellValueInj, inject, refAutoReset } from '#imports'

const value = inject(CellValueInj)

const timeout = 3000 // in ms

const showEditWarning = refAutoReset(false, timeout)
const showClearWarning = refAutoReset(false, timeout)

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      showEditWarning.value = true
      break
    case 'Delete':
      showClearWarning.value = true
      break
  }
})
</script>

<template>
  <div>
    <span class="text-center pl-3">
      {{ value }}
    </span>

    <div>
      <div v-if="showEditWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        <!-- TODO: i18n -->
        Warning: Computed field - unable to edit content.
      </div>
      <div v-if="showClearWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        <!-- TODO: i18n -->
        Warning: Computed field - unable to clear content.
      </div>
    </div>
  </div>
</template>
