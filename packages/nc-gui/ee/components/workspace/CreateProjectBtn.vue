<script setup lang="ts">
import type { ButtonType } from 'ant-design-vue/lib/button'

const props = defineProps<{
  activeWorkspaceId?: string
  modal?: boolean
  type?: ButtonType
  size?: NcButtonSize
  centered?: boolean
  // isOpen: boolean
}>()

const { isUIAllowed } = useRoles()

const baseStore = useBase()
const { isSharedBase } = storeToRefs(baseStore)

const workspaceStore = useWorkspace()
const { activeWorkspaceId: _activeWorkspaceId } = storeToRefs(workspaceStore)

const baseCreateDlg = ref(false)
const baseType = ref(NcProjectType.DB)
const dashboardProjectCreateDlg = ref(false)

const size = computed(() => props.size || 'small')
const centered = computed(() => props.centered ?? true)

/* const openCreateDashboardProjectOverlay = () => {
  dashboardProjectCreateDlg.value = true
} */
</script>

<template>
  <NcButton
    v-if="isUIAllowed('baseCreate') && !isSharedBase"
    v-e="['c:base:create']"
    type="text"
    :size="size"
    :centered="centered"
    @click="baseCreateDlg = true"
  >
    <slot>
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect width="16" height="16" rx="8" fill="#D6E0FF" />
          <path d="M8 4V12" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 8H12" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round" />
        </svg>

        <div class="flex">{{ $t('title.createBase') }}</div>
      </div>
    </slot>

    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" :type="baseType" />
    <WorkspaceCreateDashboardProjectDlg v-model="dashboardProjectCreateDlg" />
  </NcButton>
  <!-- <a-dropdown v-model:visible="isOpen" class="w-full">
      <template #overlay>
        <a-menu>
          <a-menu-item @click="navigateToCreateProject(NcProjectType.DB)">
            <div class="py-4 px-1 flex items-center gap-2 nc-create-base-btn-db">
              <GeneralProjectIcon :type="NcProjectType.DB" class="text-[#2824FB] text-lg" />
              Database
              <span class="flex-grow" />
              <GeneralShortcutLabel class="justify-center" :keys="['Alt', 'D']" />
            </div>
          </a-menu-item>
          <a-menu-item @click="openCreateDashboardProjectOverlay()">
            <div class="py-4 px-1 flex items-center gap-2">
              <GeneralProjectIcon :type="NcProjectType.DASHBOARD" class="text-[#2824FB] text-lg" />
              Dashboard
              <span class="flex-grow" />
              <GeneralShortcutLabel class="justify-center" :keys="['Alt', 'D']" />
            </div>
          </a-menu-item>
          <a-menu-item @click="navigateToCreateProject(NcProjectType.DOCS)">
            <div class="py-4 px-1 flex items-center gap-2 nc-create-base-btn-docs">
              <GeneralProjectIcon :type="NcProjectType.DOCS" class="text-[#247727] text-lg" />
              Documentation
              <span class="flex-grow" />
              <GeneralShortcutLabel class="justify-center" :keys="['Alt', 'B']" />
            </div>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown> -->
</template>

<style scoped></style>
