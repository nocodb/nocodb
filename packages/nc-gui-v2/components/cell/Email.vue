<script lang="ts" setup>
import { computed } from '#imports'

import { isEmail } from '~/utils/validation'

interface Props {
  modelValue: string
}

const { modelValue } = defineProps<Props>()

const validEmail = computed(() => isEmail(modelValue))
</script>

<script lang="ts">
export default {
  name: 'EmailCell',
}
</script>

<template>
  <a v-if="validEmail" :href="`mailto:${modelValue}`" target="_blank">{{ modelValue }}</a>
  <span v-else>{{ modelValue }}</span>
</template>
