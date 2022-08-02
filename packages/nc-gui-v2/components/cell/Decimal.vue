<script lang="ts" setup>
import { computed, inject, onMounted, ref } from '#imports'

interface Props {
  modelValue: number
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const editEnabled = inject<boolean>('editEnabled')

const root = ref<HTMLInputElement>()

const vModel = useVModel(props, 'modelValue', emits)

onMounted(() => {
  root.value?.focus()
})
</script>

<template>
  <input
    v-if="editEnabled"
    ref="root"
    v-model="vModel"
    class="outline-none pa-0 border-none w-full h-full prose-sm"
    type="number"
    step="0.1"
  />
  <span v-else class="prose-sm">{{ vModel }}</span>
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
}
</style>
