<script setup lang="ts">
import { CellValueInj, inject } from '#imports'

const value = inject(CellValueInj)

const showEditWarning = ref(false)

const showClearWarning = ref(false)

const showEditWarningMessage = () => {
  showEditWarning.value = true

  setTimeout(() => {
    showEditWarning.value = false
  }, 3000)
}

const showClearWarningMessage = () => {
  showClearWarning.value = true

  setTimeout(() => {
    showClearWarning.value = false
  }, 3000)
}

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      showEditWarningMessage()
      break
    case 'Delete':
      showClearWarningMessage()
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
