<script setup lang="ts">
import { NcProjectType, useRouter } from '#imports'

const props = defineProps<{
  activeWorkspaceId: string
  modal?: boolean
  type?: string
}>()

const emit = defineEmits<{
  (event: 'createProject', type: NcProjectType): void
}>()

const router = useRouter()

const projectCreateDlg = ref(false)
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
    <a-dropdown>
      <a-button :type="props.type ?? 'primary'">
        <div class="flex items-center gap-2">
          <slot>New Project <MdiMenuDown /></slot>
        </div>
      </a-button>
      <template #overlay>
        <a-menu>
          <a-menu-item @click="navigateToCreateProject(NcProjectType.DB)">
            <div class="py-4 px-1 flex items-center gap-4 nc-create-project-btn-db">
              <GeneralProjectIcon :type="NcProjectType.DB" class="text-[#2824FB] text-lg" />
              Database
              <span class="flex-grow" />
              <GeneralShortcutLabel class="justify-center" :keys="['Alt', 'D']" />
            </div>
          </a-menu-item>
          <a-menu-item @click="navigateToCreateProject(NcProjectType.DOCS)">
            <div class="py-4 px-1 flex items-center gap-4 nc-create-project-btn-docs">
              <GeneralProjectIcon :type="NcProjectType.DOCS" class="text-[#247727] text-lg" />
              Documentation
              <span class="flex-grow" />
              <GeneralShortcutLabel class="justify-center" :keys="['Alt', 'B']" />
            </div>
          </a-menu-item>
          <!--          <a-menu-item @click="navigateToCreateProject(NcProjectType.AUTOMATION)">
            <div class="py-4 px-1 flex items-center gap-4">
              <GeneralProjectIcon :type="NcProjectType.AUTOMATION" class="text-[#DDB00F] text-lg" />
              Automation
            </div>
          </a-menu-item>
          <a-menu-item @click="navigateToCreateProject(NcProjectType.COWRITER)">
            <div class="py-4 px-1 flex items-center gap-4">
              <GeneralProjectIcon :type="NcProjectType.COWRITER" class="text-[#8626FF] text-lg" />
              Cowriter
            </div>
          </a-menu-item> -->
        </a-menu>
      </template>
    </a-dropdown>
    <WorkspaceCreateProjectDlg v-model="projectCreateDlg" :type="projectType" />
  </div>
</template>

<style scoped></style>
