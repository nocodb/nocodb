<script setup lang="ts">
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

function onKeyDown(evt: KeyboardEvent) {
  return evt.key === '.' && evt.preventDefault()
}
</script>

<template>
  <input
    v-if="editEnabled"
    ref="root"
    v-model="vModel"
    class="outline-none pa-0 border-none w-full h-full prose-sm"
    type="number"
    @keydown="onKeyDown"
  />
  <span v-else class="prose-sm">{{ vModel }}</span>
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
}
</style>
