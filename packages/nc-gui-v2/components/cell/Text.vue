<script setup lang="ts">
import { inject, onMounted, ref } from '#imports'

interface Props {
  modelValue: any
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject<boolean>('editEnabled', false)

const root = ref<HTMLInputElement>()

const vModel = useVModel(props, 'modelValue', emits)

const onSetRef = (el: HTMLInputElement) => {
  el?.focus()
}
</script>

<template>
  <input v-if="editEnabled" :ref="onSetRef" v-model="vModel" class="h-full w-full outline-none" />
  <span v-else>{{ vModel }}</span>
</template>

<style scoped></style>
