<script setup lang="ts">
import { computed, inject, onMounted, ref } from '#imports'

interface Props {
  modelValue?: string
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject<boolean>('editEnabled', false)

const root = ref<HTMLInputElement>()

const vModel = useVModel(props, 'modelValue', emits)

onMounted(() => {
  root.value?.focus()
})

watch(
  () => root.value,
  (el) => {
    el?.focus()
  },
)
</script>

<template>
  <textarea
    v-if="editEnabled"
    ref="root"
    v-model="vModel"
    rows="4"
    class="h-full w-full min-h-[60px] outline-none"
    @keydown.alt.enter.stop
    @keydown.shift.enter.stop
  />
  <span v-else>{{ vModel }}</span>
</template>

<style scoped>
textarea:focus {
  @apply ring-transparent;
}
</style>
