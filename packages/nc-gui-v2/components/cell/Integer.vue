<script setup lang="ts">
interface Props {
  modelValue: number
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const editEnabled = inject<boolean>('editEnabled')

const root = ref<HTMLInputElement>()

const localState = computed({
  get: () => value,
  set: (val) => emit('update:modelValue', val),
})

onMounted(() => {
  root.value?.focus()
})
</script>

<template>
  <input v-if="editEnabled" ref="root" v-model="localState" type="number" />
  <span v-else>{{ localState }}</span>
</template>

<style scoped>
input {
  outline: none;
  width: 100%;
  height: 100%;
  color: var(--v-textColor-base);
}
</style>
