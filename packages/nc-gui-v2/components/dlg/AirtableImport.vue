<script setup lang="ts">
import type { UploadChangeParam } from 'ant-design-vue'

const { modelValue = false } = defineProps<{ modelValue?: boolean }>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})
</script>

<template>
  <v-dialog
    v-model="dialogShow"
    persistent
    max-width="550"
    @keydown.esc="dialogShow = false"
    @keydown.enter="$emit('create', table)"
  >
    <v-card class="elevation-1 backgroundColor">
      <!-- TODO  -->
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss"></style>
