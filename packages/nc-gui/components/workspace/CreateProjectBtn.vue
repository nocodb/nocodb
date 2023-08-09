<script setup lang="ts">
import { NcProjectType, useRouter } from '#imports'

const props = defineProps<{
  activeWorkspaceId: string
  modal?: boolean
  type?: string
  isOpen: boolean
}>()

const router = useRouter()

const projectCreateDlg = ref(false)
const projectType = ref(NcProjectType.DB)

const navigateToCreateProject = (type: NcProjectType) => {
  if (props.modal) {
    projectType.value = type
    projectCreateDlg.value = true
  } else {
    router.push({
      path: '/create',
      query: {
        type,
        workspaceId: props.activeWorkspaceId,
      },
    })
  }
}

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      // ALT + D
      case 68: {
        e.stopPropagation()
        navigateToCreateProject(NcProjectType.DB)
        break
      }
    }
  }
})
</script>

<template>
  <div>
    <a-button
      class="!py-0 !px-0 !border-0 !h-full !rounded-md w-full hover:bg-gray-100 text-sm select-none cursor-pointer"
      :type="props.type ?? 'primary'"
      @click="navigateToCreateProject(NcProjectType.DB)"
    >
      <div class="flex w-full items-center gap-2">
        <slot>New Project <MdiMenuDown /></slot>
      </div>
    </a-button>
    <WorkspaceCreateProjectDlg v-model="projectCreateDlg" :type="projectType" />
  </div>
</template>

<style scoped></style>
