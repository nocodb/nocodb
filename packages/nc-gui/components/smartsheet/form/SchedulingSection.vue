<script lang="ts" setup>
import type { FormType } from 'nocodb-sdk'

interface Props {
  formViewData: FormType
  isLocked?: boolean
  isEditable?: boolean
}

defineProps<Props>()

defineEmits(['updateView'])
</script>

<template>
  <NcSpanHidden />
</template>
