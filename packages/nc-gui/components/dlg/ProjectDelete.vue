<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  projectId: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { closeTab } = useTabs()

const { projects } = storeToRefs(useProjects())
const { deleteProject } = useProjects()

const project = computed(() => projects.value.get(props.projectId))

const isLoading = ref(false)

const onDelete = async () => {
  if (!project.value) return

  const toBeDeletedProject = JSON.parse(JSON.stringify(project.value))

  isLoading.value = true
  try {
    await deleteProject(toBeDeletedProject.id!)
    await closeTab(toBeDeletedProject.id as any)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralModal v-model:visible="visible">
    <div class="flex flex-col p-6">
      <div class="flex flex-row pb-2 mb-4 font-medium text-lg border-b-1 border-gray-50 text-gray-800">
        {{ $t('general.delete') }} {{ $t('objects.project') }}
      </div>

      <div class="mb-3 text-gray-800">Are you sure you want to delete the following project?</div>

      <div v-if="project" class="flex flex-row items-center py-2 px-3.75 bg-gray-50 rounded-lg text-gray-700 mb-4">
        <GeneralProjectIcon :type="project.type" class="nc-view-icon px-1.5"></GeneralProjectIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.5"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ project.title }}
        </div>
      </div>

      <div class="flex flex-row items-center py-2 px-3 border-1 border-gray-100 rounded-lg text-gray-700">
        <GeneralIcon icon="warning" class="text-orange-500 pl-1"></GeneralIcon>
        <div class="pl-1.75 text-gray-500">This action cannot be undone</div>
      </div>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 border-t-1 border-gray-50 justify-end">
        <a-button key="back" class="!rounded-md !font-medium" @click="visible = false">{{ $t('general.cancel') }}</a-button>

        <a-button
          key="submit"
          class="!rounded-md !font-medium"
          type="danger"
          html-type="submit"
          :loading="isLoading"
          @click="onDelete"
        >
          {{ $t('general.delete') }} {{ $t('objects.project') }}
        </a-button>
      </div>
    </div>
  </GeneralModal>
</template>
