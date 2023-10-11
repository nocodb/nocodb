<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const baseId = ref<string>()

function toggleDialog(value?: boolean, key?: string, dsState?: string, pId?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
  baseId.value = pId || ''
}

provide(ToggleDialogInj, toggleDialog)
</script>

<template>
  <div>
    <NuxtPage :transition="false" />
  </div>
</template>

<style scoped></style>
