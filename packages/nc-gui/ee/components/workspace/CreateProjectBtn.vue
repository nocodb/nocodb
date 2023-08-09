<script setup lang="ts">
import type { ButtonType } from 'ant-design-vue/lib/button'
import { NcProjectType, useRouter } from '#imports'

const props = defineProps<{
  activeWorkspaceId: string
  modal?: boolean
  type?: ButtonType
  // isOpen: boolean
}>()

// const emits = defineEmits(['update:isOpen'])

const router = useRouter()

// v-model for isOpen
// const isOpen = useVModel(props, 'isOpen', emits)

const projectCreateDlg = ref(false)
const dashboardProjectCreateDlg = ref(false)
const projectType = ref(NcProjectType.DB)

const navigateToCreateProject = (type: NcProjectType) => {
  if (type === NcProjectType.AUTOMATION) {
    return message.info('Automation is not available at the moment')
  } else {
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
}

/* const openCreateDashboardProjectOverlay = () => {
  dashboardProjectCreateDlg.value = true
} */

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
      // ALT + B
      case 66: {
        e.stopPropagation()
        navigateToCreateProject(NcProjectType.DOCS)
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
    <WorkspaceCreateProjectDlg v-model="projectCreateDlg" :type="projectType" />
    <WorkspaceCreateDashboardProjectDlg v-model="dashboardProjectCreateDlg" />
  </div>
</template>

<style scoped></style>
