<script setup lang="ts">
import type { NcButtonSize } from '~/lib'

const props = defineProps<{
  activeWorkspaceId?: string | undefined
  modal?: boolean
  type?: string
  isOpen: boolean
  size?: NcButtonSize
  centered?: boolean
}>()

const { isUIAllowed } = useUIPermission()

const { orgRoles, workspaceRoles } = useRoles()

const projectStore = useProject()
const { isSharedBase } = storeToRefs(projectStore)

const workspaceStore = useWorkspace()
const { activeWorkspaceId: _activeWorkspaceId } = storeToRefs(workspaceStore)

const projectCreateDlg = ref(false)

const size = computed(() => props.size || 'small')
const centered = computed(() => props.centered ?? true)
</script>

<template>
  <NcButton
    v-if="isUIAllowed('projectCreate', false, workspaceRoles ?? orgRoles) && !isSharedBase"
    type="text"
    :size="size"
    :centered="centered"
    @click="projectCreateDlg = true"
  >
    <slot />
    <WorkspaceCreateProjectDlg v-model="projectCreateDlg" />
  </NcButton>
</template>

<style scoped></style>
