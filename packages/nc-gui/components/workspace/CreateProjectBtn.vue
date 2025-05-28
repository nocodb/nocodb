<script setup lang="ts">
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
    full-width
    @click="baseCreateDlg = true"
  >
    <slot>
      <div class="flex items-center gap-2 w-full">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect width="16" height="16" rx="8" fill="#D6E0FF" />
          <path d="M8 4V12" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 8H12" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round" />
        </svg>

        <div class="flex flex-1">{{ $t('title.createBase') }}</div>

        <div class="px-1 flex-none text-bodySmBold !leading-[18px] text-nc-content-gray-subtle bg-nc-bg-gray-medium rounded">
          {{ renderAltOrOptlKey(true) }} D
        </div>
      </div>
    </slot>
    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
  </NcButton>
</template>

<style scoped></style>
