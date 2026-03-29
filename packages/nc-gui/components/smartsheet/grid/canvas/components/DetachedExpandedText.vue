<script lang="ts" setup>
import ExpandedText from '../components/ExpandedText.vue'
import { useDetachedLongText } from '../composables/useDetachedLongText'

const { states } = useDetachedLongText()
</script>

<template>
  <template v-for="(state, i) of states" :key="`expanded-text-${i}`">
    <ExpandedText v-model:model-visible="state.isOpen" v-model="state.vModel" :column="state.column" />
  </template>
</template>
