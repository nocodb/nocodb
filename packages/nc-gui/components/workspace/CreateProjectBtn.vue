<script setup lang="ts">
import type { NcButtonSize } from '~/lib/types'

const props = defineProps<{
  activeWorkspaceId?: string | undefined
  modal?: boolean
  type?: string
  isOpen: boolean
  size?: NcButtonSize
  centered?: boolean
}>()

const { isUIAllowed } = useRoles()

const { orgRoles, workspaceRoles } = useRoles()

const baseStore = useBase()
const { isSharedBase } = storeToRefs(baseStore)

const workspaceStore = useWorkspace()
const { activeWorkspaceId: _activeWorkspaceId } = storeToRefs(workspaceStore)

const baseCreateDlg = ref(false)

const size = computed(() => props.size || 'small')
const centered = computed(() => props.centered ?? true)
</script>

<template>
  <NcButton
    v-if="isUIAllowed('baseCreate', { roles: workspaceRoles ?? orgRoles }) && !isSharedBase"
    v-e="['c:base:create']"
    type="text"
    :size="size"
    :centered="centered"
    @click="baseCreateDlg = true"
  >
    <slot />
    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
  </NcButton>
</template>

<style scoped></style>
