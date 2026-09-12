<script setup lang="ts">
import type { Row } from '~/lib/types'

/** CE placeholder — record presence is EE-only. */
interface Props {
  row?: Row
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
