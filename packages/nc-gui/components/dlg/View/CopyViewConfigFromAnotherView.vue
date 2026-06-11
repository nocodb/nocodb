<script lang="ts" setup>
import type { ViewSettingOverrideOptions, ViewType } from 'nocodb-sdk'

interface Props {
  modelValue?: boolean
  defaultSelectedCopyViewConfigTypes?: ViewSettingOverrideOptions[]
  destView: ViewType
}
defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
