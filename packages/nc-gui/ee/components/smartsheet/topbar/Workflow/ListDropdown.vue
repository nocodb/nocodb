<script setup lang="ts">
import type { WorkflowType } from 'nocodb-sdk'

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { base } = storeToRefs(useBase())

const workflowStore = useWorkflowStore()

const { openWorkflow, openNewWorkflowModal } = workflowStore

const { activeWorkflow, activeBaseWorkflows } = storeToRefs(workflowStore)

const isOpen = ref<boolean>(false)

/**
 * Handles navigation to a selected workflow.
 *
 * @param workflow - The workflow to navigate to.
 *
 * @remarks
 * This function is called when a user selects a workflow from the dropdown list.
 * It checks if the workflow has a valid ID and then opens the selected workflow.
 */
const handleNavigateToWorkflow = (workflow: WorkflowType) => {
  if (workflow?.id) {
    openWorkflow(workflow)
  }
}

function openWorkflowCreateDialog() {
  isOpen.value = false

  openNewWorkflowModal({
    baseId: base.value?.id,
    e: 'c:workflow:create:topbar',
    loadWorkflowsOnClose: true,
    scrollOnCreate: true,
  })
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" overlay-class-name="max-w-64">
    <slot name="default" :is-open="isOpen"></slot>
    <template #overlay>
      <LazyNcList
        v-model:open="isOpen"
        :value="activeWorkflow.id"
        :list="activeBaseWorkflows"
        option-value-key="id"
        option-label-key="title"
        class="min-w-64 !w-auto"
        search-input-placeholder="Search workflows"
        variant="medium"
        @change="handleNavigateToWorkflow"
      >
        <template #listItem="{ option }">
          <div>
            <LazyGeneralEmojiPicker :emoji="option?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralIcon icon="ncAutomation" class="min-w-4 text-lg flex" />
              </template>
            </LazyGeneralEmojiPicker>
          </div>
          <NcTooltip class="truncate flex-1" show-on-truncate-only>
            <template #title>
              {{ option?.title }}
            </template>
            {{ option?.title }}
          </NcTooltip>
          <GeneralIcon
            v-if="option.id === activeWorkflow.id"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-primary w-4 h-4"
          />
        </template>

        <template v-if="!isMobileMode && isUIAllowed('workflowCreateOrEdit')" #listFooter>
          <NcDivider class="!mt-0 !mb-2" />
          <div class="px-2 mb-2" @click="openWorkflowCreateDialog()">
            <div
              class="px-2 py-1.5 flex items-center justify-between gap-2 text-sm font-weight-500 !text-nc-content-brand hover:bg-nc-bg-gray-light rounded-md cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="plus" />
                <div>
                  {{
                    $t('general.createEntity', {
                      entity: $t('objects.workflow'),
                    })
                  }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </LazyNcList>
    </template>
  </NcDropdown>
</template>
