<script setup lang="ts">
import { type ColumnType } from 'nocodb-sdk'

interface Props {
  column: ColumnType
  mode: 'preview' | 'list'
}
defineProps<Props>()
</script>

<template><div></div></template>
