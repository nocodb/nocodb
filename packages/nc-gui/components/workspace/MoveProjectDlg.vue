<script setup lang="ts">
import type { BaseType } from 'nocodb-sdk'
import { WorkspaceUserRoles } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  base: BaseType
}>()

const emit = defineEmits(['update:modelValue', 'success'])

const dialogShow = useVModel(props, 'modelValue', emit)

const workspaceStore = useWorkspace()
const { moveWorkspace } = workspaceStore
const { workspacesList } = storeToRefs(workspaceStore)

const workspaceId = ref()

const _moveWorkspace = async () => {
  await moveWorkspace(workspaceId.value, props.base.id!)
  emit('success', workspaceId.value)
}

watch(dialogShow, (val) => {
  if (!val) {
    workspaceId.value = null
  }
})

const ownedWorkspaces = computed(() => {
  return workspacesList.value.filter((w) => w.roles === WorkspaceUserRoles.OWNER)
})
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    width="max(30vw, 600px)"
    centered
    wrap-class-name="nc-modal-workspace-create"
    @keydown.esc="dialogShow = false"
  >
    <template #footer>
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" :disabled="!workspaceId" size="large" type="primary" @click="_moveWorkspace">{{
        $t('general.move')
      }}</a-button>
    </template>

    <div class="pl-10 pr-10 pt-5">
      <!-- Create A New Table -->
      <div class="prose-xl font-bold self-center my-4">{{ $t('activity.moveProject') }}</div>

      <div class="mb-2">{{ $t('objects.workspace') }}</div>
      <a-select v-model:value="workspaceId" class="w-full" show-search>
        <a-select-option v-for="workspace of ownedWorkspaces" :key="workspace.id" :value="workspace.id">
          {{ workspace.title }}
        </a-select-option>
      </a-select>
    </div>
  </a-modal>
</template>

<style scoped lang="scss">
.nc-workspace-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 200px;
  }
}
</style>
