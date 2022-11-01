<script setup lang="ts">
import { message } from 'ant-design-vue'
import { CellValueInj, inject } from '#imports'

const value = inject(CellValueInj)

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      message.warning('Computed field: unable to edit')
      break
    case 'Delete':
      message.warning('Computed field: unable to clear text')
      break
  }
})
</script>

<template>
  <span class="text-center pl-3">
    {{ value }}
  </span>
</template>
