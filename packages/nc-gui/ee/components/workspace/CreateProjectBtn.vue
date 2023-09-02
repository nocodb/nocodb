<script setup lang="ts">
import type { ButtonType } from 'ant-design-vue/lib/button'
import { NcProjectType, useRouter } from '#imports'
import type { NcButtonSize } from '~/lib'

const props = defineProps<{
  activeWorkspaceId?: string
  modal?: boolean
  type?: ButtonType
  size?: NcButtonSize
  centered?: boolean
  // isOpen: boolean
}>()

const { isUIAllowed } = useUIPermission()

const projectStore = useProject()
const { isSharedBase } = storeToRefs(projectStore)

const workspaceStore = useWorkspace()
const { activeWorkspace, activeWorkspaceId: _activeWorkspaceId } = storeToRefs(workspaceStore)

const projectCreateDlg = ref(false)
const projectType = ref(NcProjectType.DB)
const dashboardProjectCreateDlg = ref(false)

const size = computed(() => props.size || 'small')
const centered = computed(() => props.centered ?? true)

/* const openCreateDashboardProjectOverlay = () => {
  dashboardProjectCreateDlg.value = true
} */
</script>

<template>
  <NcButton
    v-if="isUIAllowed('createProject', false, activeWorkspace?.roles) && !isSharedBase"
    type="text"
    :size="size"
    :centered="centered"
    @click="projectCreateDlg = true"
  >
    <slot />

    <WorkspaceCreateProjectDlg v-model="projectCreateDlg" :type="projectType" />
    <WorkspaceCreateDashboardProjectDlg v-model="dashboardProjectCreateDlg" />
  </NcButton>
  <!-- <a-dropdown v-model:visible="isOpen" class="w-full">
      <template #overlay>
        <a-menu>
          <a-menu-item @click="navigateToCreateProject(NcProjectType.DB)">
            <div class="py-4 px-1 flex items-center gap-2 nc-create-project-btn-db">
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
            <div class="py-4 px-1 flex items-center gap-2 nc-create-project-btn-docs">
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
