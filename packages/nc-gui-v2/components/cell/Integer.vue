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
  <input v-if="editEnabled" ref="root" v-model="vModel" class="outline-none w-full h-full" type="number" @keydown="onKeyDown" />
  <span v-else>{{ vModel }}</span>
</template>

<style scoped></style>
