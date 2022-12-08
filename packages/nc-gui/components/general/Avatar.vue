<script setup lang="ts">
import Avatar from 'vue-boring-avatars'

const {
  name,
  colors = ['#FA8CB1', '#FDC5C9', '#f8d8c3', '#cfb699', '#9e6d4e'],
  size = 30,
  variant = 'beam',
} = defineProps<{ name: string; colors?: string[]; size?: number | string; variant?: string }>()
</script>

<template>
  <Avatar :size="size" :variant="variant" :colors="colors" :name="name" />
</template>
