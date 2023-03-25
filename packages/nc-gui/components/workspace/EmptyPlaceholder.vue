<script lang="ts" setup>
import { NcProjectType, useWorkspace } from '#imports'

const props = defineProps<{
  buttons?: boolean
}>()

const projectCreateDlg = ref(false)
const projectType = ref()
const workspaceStore = useWorkspace()

const router = useRouter()

const loading = ref(false)

// if at least one project exists, redirect to first project
watch(
  () => workspaceStore.projects,
  (projects) => {
    if (projects?.length) {
      return router.replace({
        path: `/ws/${router.currentRoute.value.params.workspaceId}/nc/${projects[0].id}`,
      })
    }
    loading.value = false
  },
  { immediate: true },
)

const openCreateProjectDlg = (type: NcProjectType) => {
  projectType.value = type
  projectCreateDlg.value = true
}
</script>

<template>
  <div class="flex items-center justify-center h-full">
    <div v-if="!loading" class="flex flex-col gap-4 items-center">
      <NcIconsInbox />
      <div class="font-weight-medium">No Projects</div>
      <template v-if="props.buttons">
        <div class="text-xs">Create Project</div>
        <div class="flex gap-2 justify mt-1">
          <a-button class="flex-1 w-57 nc-btn" @click="openCreateProjectDlg(NcProjectType.DB)">
            <div class="flex gap-2 items-center justify-center text-xs">
              <GeneralProjectIcon :type="NcProjectType.DB" class="text-[#2824FB] text-lg" />
              New Database Project
            </div>
          </a-button>
          <a-button class="flex-1 w-57 nc-btn" @click="openCreateProjectDlg(NcProjectType.DOCS)">
            <div class="flex gap-2 items-center justify-center text-xs">
              <GeneralProjectIcon :type="NcProjectType.DOCS" class="text-[#247727] text-lg" />
              New Documentation Project
            </div>
          </a-button>
        </div>

        <WorkspaceCreateProjectDlg v-model="projectCreateDlg" :type="projectType" />
      </template>
    </div>
  </div>
</template>

<style scoped></style>
