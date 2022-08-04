<script setup lang="ts">
import { ValueInj } from '~/context'

const value = inject(ValueInj)
</script>

<template>
  <span class="text-center pl-3">
    {{ value }}
  </span>
</template>
