<script setup lang="ts">
import type { ButtonType } from 'ant-design-vue/lib/button'
import { NcProjectType, useRouter } from '#imports'
import type { NcButtonSize } from '~/lib'

const props = defineProps<{
  activeWorkspaceId?: string
  modal?: boolean
  class?: string
  type?: ButtonType
  size?: NcButtonSize
  centered?: boolean
  // isOpen: boolean
}>()

// const emits = defineEmits(['update:isOpen'])

const router = useRouter()
const route = router.currentRoute

const { isUIAllowed } = useUIPermission()

// v-model for isOpen
// const isOpen = useVModel(props, 'isOpen', emits)

const projectCreateDlg = ref(false)
const dashboardProjectCreateDlg = ref(false)
const projectType = ref(NcProjectType.DB)

const projectStore = useProject()
const { isSharedBase } = storeToRefs(projectStore)

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const size = computed(() => props.size || 'small')
const activeWorkspaceId = computed(() => props.activeWorkspaceId || route.value.params.typeOrId)
const centered = computed(() => props.centered ?? true)
const className = computed(() => props.class ?? '')

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
          workspaceId: activeWorkspaceId.value,
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
</template>

<style scoped></style>
