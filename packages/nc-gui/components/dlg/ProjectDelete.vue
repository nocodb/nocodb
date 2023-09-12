<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  projectId: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { closeTab } = useTabs()

const projectsStore = useProjects()
const { deleteProject, navigateToFirstProjectOrHome } = projectsStore
const { projects } = storeToRefs(projectsStore)

const { refreshCommandPalette } = useCommandPalette()

const project = computed(() => projects.value.get(props.projectId))

const isLoading = ref(false)

const onDelete = async () => {
  if (!project.value) return

  const toBeDeletedProject = JSON.parse(JSON.stringify(project.value))

  isLoading.value = true
  try {
    await deleteProject(toBeDeletedProject.id!)
    await closeTab(toBeDeletedProject.id as any)

    refreshCommandPalette()

    visible.value = false

    if (toBeDeletedProject.id === projectsStore.activeProjectId) {
      await navigateToFirstProjectOrHome()
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="visible" :entity-name="$t('objects.project')" :on-delete="onDelete">
    <template #entity-preview>
      <div v-if="project" class="flex flex-row items-center py-2 px-2.25 bg-gray-50 rounded-lg text-gray-700 mb-4">
        <GeneralProjectIcon :type="project.type" class="nc-view-icon px-1.5"></GeneralProjectIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ project.title }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
