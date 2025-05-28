<script setup lang="ts">
import type { ScriptType } from 'nocodb-sdk'

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { base } = storeToRefs(useBase())

const automationStore = useAutomationStore()

const { openScript, openNewScriptModal } = automationStore

const { activeAutomation, activeBaseAutomations } = storeToRefs(automationStore)

const isOpen = ref<boolean>(false)

/**
 * Handles navigation to a selected automation.
 *
 * @param automation - The automation to navigate to.
 *
 * @remarks
 * This function is called when a user selects a script from the dropdown list.
 * It checks if the automation has a valid ID and then opens the selected automation.
 */
const handleNavigateToScript = (script: ScriptType) => {
  if (script?.id) {
    openScript(script)
  }
}

function openAutomationCreateDialog() {
  openNewScriptModal({
    baseId: base.value?.id,
    e: 'c:automation:create:topbar',
    loadAutomationsOnClose: true,
    scrollOnCreate: true,
  })
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen">
    <slot name="default" :is-open="isOpen"></slot>
    <template #overlay>
      <LazyNcList
        v-model:open="isOpen"
        :value="activeAutomation.id"
        :list="activeBaseAutomations"
        option-value-key="id"
        option-label-key="title"
        search-input-placeholder="Search automations"
        @change="handleNavigateToScript"
      >
        <template #listItem="{ option }">
          <div>
            <LazyGeneralEmojiPicker :emoji="option?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralIcon icon="ncScript" class="min-w-4 !text-gray-500" />
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
            v-if="option.id === activeAutomation.id"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-primary w-4 h-4"
          />
        </template>

        <template v-if="!isMobileMode && isUIAllowed('scriptCreateOrEdit')" #listFooter>
          <NcDivider class="!mt-0 !mb-2" />
          <div class="px-2 mb-2" @click="openAutomationCreateDialog()">
            <div
              class="px-2 py-1.5 flex items-center justify-between gap-2 text-sm font-weight-500 !text-brand-500 hover:bg-gray-100 rounded-md cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="plus" />
                <div>
                  {{
                    $t('general.createEntity', {
                      entity: $t('objects.script'),
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
