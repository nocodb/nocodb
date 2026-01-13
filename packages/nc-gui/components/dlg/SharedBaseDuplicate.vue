<script setup lang="ts">
import { WorkspaceUserRoles } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const { workspacesList } = storeToRefs(useWorkspace())

const { duplicateSharedBase, isLoading, options, selectedWorkspace, isUseThisTemplate, templateName } = useCopySharedBase()

const dialogShow = useVModel(props, 'modelValue', emit)

const _duplicate = async () => {
  if (!selectedWorkspace.value && isEeUI) return

  await duplicateSharedBase({
    workspaceId: selectedWorkspace.value ?? 'nc',
    onComplete: () => {
      dialogShow.value = false
    },
  })
}

const filterWorkspace = (workspace: NcWorkspace) => {
  if (!workspace) return false

  return [WorkspaceUserRoles.OWNER, WorkspaceUserRoles.CREATOR].includes(workspace.roles as WorkspaceUserRoles)
}
</script>

<template>
  <GeneralModal
    v-model:visible="dialogShow"
    :mask-closable="!isLoading"
    class="!w-[30rem]"
    wrap-class-name="nc-modal-project-duplicate"
  >
    <div>
      <div class="prose-xl font-bold self-center">
        <template v-if="isUseThisTemplate">
          {{ templateName || $t('labels.useThisTemplate') }}
        </template>
        <template v-else> {{ $t('general.duplicate') }} {{ $t('labels.sharedBase') }} </template>
      </div>

      <template v-if="isEeUI">
        <div class="mt-4 mb-2">
          {{
            isUseThisTemplate ? $t('labels.chooseWorkspaceToApplyTemplate') : $t('labels.selectWorkspaceToDuplicateSharedBaseTo')
          }}
        </div>

        <NcListWorkspaceSelector
          v-model:value="selectedWorkspace"
          placeholder="Select workspace"
          force-layout="vertical"
          disable-label
          :workspace-list="workspacesList"
          :filter-workspace="filterWorkspace"
        />
      </template>

      <template v-if="!isUseThisTemplate">
        <div class="prose-md self-center text-gray-500 mt-4">{{ $t('title.advancedSettings') }}</div>

        <a-divider class="!m-0 !p-0 !my-2" />

        <div class="text-xs p-2">
          <a-checkbox v-model:checked="options.includeData">{{ $t('labels.includeData') }}</a-checkbox>
          <a-checkbox v-model:checked="options.includeViews">{{ $t('labels.includeView') }}</a-checkbox>
        </div>
      </template>
    </div>
    <div
      class="flex flex-row gap-x-2 pt-2.5 justify-end"
      :class="{
        'mt-2.5': !isUseThisTemplate,
        'mt-4.5': isUseThisTemplate,
      }"
    >
      <NcButton key="back" type="secondary" :disabled="isLoading" @click="dialogShow = false">{{
        $t('general.cancel')
      }}</NcButton>
      <NcButton
        key="submit"
        v-e="['a:shared-base:duplicate']"
        :loading="isLoading"
        :disabled="!selectedWorkspace && isEeUI"
        @click="_duplicate"
      >
        {{ isUseThisTemplate ? $t('general.apply') : $t('general.confirm') }}
      </NcButton>
    </div>
  </GeneralModal>
</template>
