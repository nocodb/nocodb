<script setup lang="ts">
import type { ScriptType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: any
  selectedScript?: ScriptType
}>()

const emits = defineEmits<{
  'update:modelValue': (value: any) => void
  'update:selectedWebhook': (value: ScriptType) => void
}>()

const selectedScript = useVModel(props, 'selectedScript', emits)
const vModel = useVModel(props, 'modelValue', emits)

const { ncNavigateTo } = useGlobal()

const baseStore = useBases()

const { openedProject } = storeToRefs(baseStore)

const isScriptSelectionDropdownOpen = ref(false)

const automationStore = useAutomationStore()

const { activeBaseAutomations } = toRefs(automationStore)

const { isScriptCreateModalOpen } = useColumnCreateStoreOrThrow()

const isScriptModal = ref(false)

const newScript = () => {
  selectedScript.value = undefined

}

const editScript = () => {
  if (selectedScript.value) {
    ncNavigateTo({
      baseId: openedProject.value!.id,
      workspaceId: openedProject.value!.fk_workspace_id,
      automationId: selectedScript.value.id,
      newTab: true,
    })
  }
}

const onSelectScript = (hook: ScriptType) => {
  vModel.value.fk_script_id = hook.id
  selectedScript.value = hook
  isScriptSelectionDropdownOpen.value = false
  isScriptModal.value = false
}

watch(isScriptModal, (newVal) => {
  if (!newVal) {
    setTimeout(() => {
      isScriptCreateModalOpen.value = false
    }, 500)
  }
})
</script>

<template>
  <a-form-item>
    <div class="mb-2 text-gray-800 text-[13px] flex justify-between">
      {{ $t('objects.script') }}
      <a
        class="font-medium"
        href="https://nocodb.com/docs/product-docs/fields/field-types/custom-types/button#create-a-button-field"
        target="_blank"
      >
        Docs
      </a>
    </div>
    <div class="flex rounded-lg">
      <NcDropdown v-model:visible="isScriptSelectionDropdownOpen" :trigger="['click']">
        <template #overlay>
          <NcListWithSearch
            v-if="isScriptSelectionDropdownOpen"
            :is-parent-open="isScriptSelectionDropdownOpen"
            :search-input-placeholder="$t('placeholder.searchFields')"
            :option-config="{ selectOptionEvent: ['c:actions:script'], optionClassName: '' }"
            :options="activeBaseAutomations"
            :selected-option-id="selectedScript?.id"
            disable-mascot
            class="max-h-72 max-w-85"
            filter-field="title"
            show-selected-option
            @selected="onSelectScript"
          >
            <!-- v-if="isUIAllowed('scriptCreate')" TODO: Add ACL -->
            <template #bottom>
              <a-divider style="margin: 4px 0" />
              <div class="flex items-center text-brand-500 text-sm cursor-pointer" @click="newScript">
                <div class="w-full flex justify-between items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100">
                  {{ $t('general.create') }} {{ $t('objects.script').toLowerCase() }}
                  <GeneralIcon icon="plus" class="flex-none" />
                </div>
              </div>
            </template>
          </NcListWithSearch>
        </template>
        <div
          :class="{
            'nc-button-style-dropdown shadow-dropdown-open remove-right-shadow': isScriptSelectionDropdownOpen,
          }"
          class="nc-button-script-select border-r-0 flex items-center justify-center border-1 h-8 px-[8px] border-gray-300 !w-full transition-all cursor-pointer !rounded-l-lg"
        >
          <div class="flex w-full items-center gap-2">
            <div
              :key="selectedScript?.id"
              class="flex items-center overflow-x-clip truncate text-ellipsis w-full gap-1 text-gray-800"
            >
              <NcTooltip
                :class="{
                  'text-gray-500': !selectedScript?.title,
                }"
                class="truncate max-w-full"
                show-on-truncate-only
              >
                <template #title>
                  {{ !selectedScript?.title ? $t('labels.selectAScript') : selectedScript?.title }}
                </template>
                {{ !selectedScript?.title ? $t('labels.selectAScript') : selectedScript?.title }}
              </NcTooltip>
            </div>
            <GeneralIcon
              icon="arrowDown"
              :class="{
                'transform rotate-180': isScriptSelectionDropdownOpen,
              }"
              class="text-gray-500 transition-all transition-transform"
            />
          </div>
        </div>
      </NcDropdown>
      <NcButton
        size="small"
        type="secondary"
        class="!rounded-l-none border-l-[#d9d9d9] !hover:bg-white nc-button-style-dropdown"
        :class="{
          'nc-button-style-dropdown shadow-dropdown-open remove-left-shadow': isScriptSelectionDropdownOpen,
        }"
        @click="editScript"
      >
        <GeneralIcon
          :class="{
            'text-gray-400': !selectedScript,
            'text-gray-700': selectedScript,
          }"
          icon="ncEdit"
        />
      </NcButton>
    </div>
  </a-form-item>

  <!--  <Webhook
    v-if="isScriptModal"
    v-model:value="isScriptModal"
    :hook="selectedScript"
    :event-list=""
    @close="onClose"
  /> -->
</template>

<style scoped lang="scss">
.shadow-dropdown-open {
  @apply transition-all duration-0.3s;

  &:not(:focus-within) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
  }
}

.nc-list-with-search {
  @apply w-full;
}

.remove-right-shadow {
  clip-path: inset(-2px 0px -2px -2px) !important;
}

.remove-left-shadow {
  clip-path: inset(-2px -2px -2px 0px) !important;
}
</style>
