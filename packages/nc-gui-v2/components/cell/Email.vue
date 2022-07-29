<script lang="ts" setup>
import { computed } from '#imports'
import { isEmail } from '~/utils'

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const editEnabled = inject<boolean>('editEnabled')

interface Props {
  modelValue: string
}

const root = ref<HTMLInputElement>()
const localState = computed({
  get: () => value,
  set: (val) => emit('update:modelValue', val),
})

const validEmail = computed(() => isEmail(value))
</script>

<script lang="ts">
export default {
  name: 'EmailCell',
}
</script>

<template>
  <input v-if="editEnabled" ref="root" v-model="localState" />
  <a
    v-else-if="validEmail"
    class="caption py-2 text-primary underline hover:opacity-75"
    :href="`mailto:${value}`"
    target="_blank"
  >
    {{ value }}
  </a>
  <span v-else>{{ value }}</span>
</template>
