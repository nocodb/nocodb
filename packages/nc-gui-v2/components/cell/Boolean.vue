<script setup lang="ts">
import { inject } from '@vue/runtime-core'

const value = inject<boolean | number>('value')
</script>

<template>
  <div class="d-flex align-center">
    <input v-model="value" type="checkbox" :disabled="true" />
  </div>
</template>
