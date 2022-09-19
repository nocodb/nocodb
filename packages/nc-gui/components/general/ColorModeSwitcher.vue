<script lang="ts" setup>
import MaterialSymbolsLightMode from '~icons/material-symbols/light-mode'
import MaterialSymbolsDarkMode from '~icons/material-symbols/dark-mode'
interface Props {
  modelValue: boolean
}

const { modelValue } = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const toggleMode = () => {
  emits('update:modelValue', !modelValue)
}
</script>

<template>
  <MaterialSymbolsLightMode v-if="modelValue" class="md:text-xl cursor-pointer" @click="toggleMode" />
  <MaterialSymbolsDarkMode v-else class="md:text-xl cursor-pointer" @click="toggleMode" />
</template>
