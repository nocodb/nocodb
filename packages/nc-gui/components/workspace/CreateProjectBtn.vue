<script setup lang="ts">
import { NcProjectType, useRouter } from '#imports'
import type { NcButtonSize } from '~/lib'

const props = defineProps<{
  activeWorkspaceId?: string | undefined
  class?: string
  modal?: boolean
  type?: string
  isOpen: boolean
  size?: NcButtonSize
  centered?: boolean
}>()

const router = useRouter()

const { isUIAllowed } = useUIPermission()

const projectStore = useProject()
const { isSharedBase } = storeToRefs(projectStore)

const workspaceStore = useWorkspace()
const { activeWorkspace, activeWorkspaceId: _activeWorkspaceId } = storeToRefs(workspaceStore)

const size = computed(() => props.size || 'small')
const activeWorkspaceId = computed(() => props.activeWorkspaceId || _activeWorkspaceId.value)
const centered = computed(() => props.centered ?? true)
const className = computed(() => props.class ?? '')

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
        workspaceId: activeWorkspaceId.value,
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
  <NcButton
    v-if="isUIAllowed('createProject', false, activeWorkspace?.roles) && !isSharedBase"
    type="text"
    :size="size"
    :class="className"
    :centered="centered"
    @click="navigateToCreateProject(NcProjectType.DB)"
  >
    <slot />
  </NcButton>
  <WorkspaceCreateProjectDlg v-model="projectCreateDlg" :type="projectType" />
</template>

<style scoped></style>
