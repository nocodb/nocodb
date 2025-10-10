<script lang="ts" setup>
import { ViewSettingOverrideOptions, type ViewType } from 'nocodb-sdk'

interface Props {
  view: ViewType
  defaultOptions?: ViewSettingOverrideOptions[]
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
