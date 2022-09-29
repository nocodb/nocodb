<script setup lang="ts">
import { CellValueInj, inject } from '#imports'

const value = inject(CellValueInj)
</script>

<template>
  <span class="text-center pl-3">
    {{ value }}
  </span>
</template>
