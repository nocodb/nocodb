<script lang="ts" setup>
import { useDetachedLongText } from '../composables/useDetachedLongText';
import ExpandedText from '../components/ExpandedText.vue';

const { states, close } = useDetachedLongText()

const shouldClose = (isVisible: boolean, i: number) => {
  if (!isVisible) close(i)
}
</script>

<template>
  <template v-for="(state, i) of states" :key="`expanded-text-${i}`">
    <ExpandedText
      v-model:model-visible="state.isOpen"
      v-model="state.vModel"
      :column="state.column"
    />
  </template>
</template>
