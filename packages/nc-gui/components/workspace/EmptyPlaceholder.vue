<script lang="ts" setup>
import { NcProjectType } from '#imports'

const props = defineProps<{
  buttons?: boolean
}>()

const projectCreateDlg = ref(false)
const projectType = ref()

const openCreateProjectDlg = (type: NcProjectType) => {
  projectType.value = type
  projectCreateDlg.value = true
}
</script>

<template>
  <div class="flex items-center justify-center mt-8">
    <div class="flex flex-col gap-4 items-center text-gray-500">
      <NcIconsInbox />
      <div class="font-medium text-gray-500">No Projects in workspace</div>
      <div class="flex gap-2 justify mt-1">
        <NcButton @click="openCreateProjectDlg(NcProjectType.DB)">
          <div class="flex gap-2 items-center justify-center text-xs">
            <GeneralIcon icon="plus" class="text-lg" />
            <div class="mb-[0.5px]">New Project</div>
          </div>
        </NcButton>
      </div>
    </div>
  </div>
  <WorkspaceCreateProjectDlg v-model="projectCreateDlg" />
</template>

<style scoped></style>
