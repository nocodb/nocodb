<script lang="ts" setup>
/* definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const projectId = ref<string>()

function toggleDialog(value?: boolean, key?: string, dsState?: string, pId?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
  projectId.value = pId || ''
}

provide(ToggleDialogInj, toggleDialog) */

// onMounted(async () => {
//   isLoading.value = true
//   try {
//     await loadWorkspace(route.params.typeOrId as string)
//     await loadProjects()
//   } finally {
//     isLoading.value = false
//   }
// })

// TODO
// const isSharedBase = ref(false)
// const currentVersion = ref('')
</script>

<template>
  <NuxtPage :transition="false" />
</template>

<style scoped></style>
