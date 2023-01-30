<script setup lang="ts">
import { CellValueInj, inject, useShowNotEditableWarning } from '#imports'

const value = inject(CellValueInj)

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning()
</script>

<template>
  <div @dblclick="activateShowEditNonEditableFieldWarning">
    <span class="text-center pl-3">
      {{ value }}
    </span>

    <div>
      <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldEditWarning') }}
      </div>
      <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldDeleteWarning') }}
      </div>
    </div>
  </div>
</template>
