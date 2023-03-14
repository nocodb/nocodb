<script setup lang="ts">
import { NcProjectType, useRouter } from '#imports'

const props = defineProps<{
  activeWorkspaceId: string
  emitEvent?:boolean
}>()

const router = useRouter()

const emit = defineEmits<{
  (event: 'createProject', type: NcProjectType): void
}>()

const navigateToCreateProject = (type: NcProjectType) => {
  if (type === NcProjectType.AUTOMATION) {
    return message.info('Automation is not available at the moment')
  } else {
    if(props.emitEvent){
      emit('createProject', type)
    }else {
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
      case 68: {
        // ALT + D
        navigateToCreateProject(NcProjectType.DB)
        break
      }
    }
  }
})
</script>

<template>
  <a-dropdown>
    <a-button type="primary">
      <div class="flex items-center gap-2">
        New Project
        <MdiMenuDown />
      </div>
    </a-button>
    <template #overlay>
      <a-menu>
        <a-menu-item @click="navigateToCreateProject(NcProjectType.DB)">
          <div class="py-4 px-1 flex items-center gap-4">
            <GeneralProjectIcon :type="NcProjectType.DB" class="text-[#2824FB] text-lg" />
            Database
          </div>
        </a-menu-item>
        <a-menu-item @click="navigateToCreateProject(NcProjectType.DOCS)">
          <div class="py-4 px-1 flex items-center gap-4">
            <GeneralProjectIcon :type="NcProjectType.DOCS" class="text-[#247727] text-lg" />
            Documentation
          </div>
        </a-menu-item>
        <a-menu-item @click="navigateToCreateProject(NcProjectType.AUTOMATION)">
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
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<style scoped></style>
