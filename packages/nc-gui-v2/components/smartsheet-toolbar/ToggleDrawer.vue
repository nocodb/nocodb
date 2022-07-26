<script setup lang="ts">
import { ReloadViewDataHookInj } from '~/context'
import MdiDoorOpenIcon from '~icons/mdi/door-open'
import MdiDoorClosedIcon from '~icons/mdi/door-closed'
const navDrawerOpened = ref(false)

const Icon = computed(()=> navDrawerOpened.value ? MdiDoorOpenIcon : MdiDoorClosedIcon)
</script>

<template>
  <Icon class="text-grey" @click="navDrawerOpened = !navDrawerOpened" />
</template>

<style scoped></style>
