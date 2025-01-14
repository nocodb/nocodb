<script setup lang="ts">
import type { HookType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: any
  selectedWebhook?: HookType
}>()

const emits = defineEmits<{
  'update:modelValue': (value: any) => void
  'update:selectedWebhook': (value: HookType) => void
}>()

const selectedWebhook = useVModel(props, 'selectedWebhook', emits)
const vModel = useVModel(props, 'modelValue', emits)

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const isWebHookSelectionDropdownOpen = ref(false)

const webhooksStore = useWebhooksStore()

const { hooks } = toRefs(webhooksStore)

const manualHooks = computed(() => {
  return hooks.value.filter((hook) => hook.event === 'manual' && hook.active)
})

const eventList = ref<Record<string, any>[]>([
  { text: [t('general.manual'), t('general.trigger')], value: ['manual', 'trigger'] },
])

const { isWebhookCreateModalOpen } = useColumnCreateStoreOrThrow()

const isWebhookModal = ref(false)

const onClose = (hook: HookType) => {
  selectedWebhook.value = hook.id ? hook : undefined
  vModel.value.fk_webhook_id = hook.id
  isWebhookModal.value = false
  setTimeout(() => {
    isWebhookCreateModalOpen.value = false
  }, 500)
}

const newWebhook = () => {
  selectedWebhook.value = undefined
  isWebhookModal.value = true
  isWebhookCreateModalOpen.value = true
}

const editWebhook = () => {
  if (selectedWebhook.value) {
    isWebhookCreateModalOpen.value = true
    isWebhookModal.value = true
  }
}

const onSelectWebhook = (hook: HookType) => {
  console.log(vModel.value)
  vModel.value.fk_webhook_id = hook.id
  selectedWebhook.value = hook
  isWebHookSelectionDropdownOpen.value = false
  isWebhookModal.value = false
}

watch(isWebhookModal, (newVal) => {
  if (!newVal) {
    setTimeout(() => {
      isWebhookCreateModalOpen.value = false
    }, 500)
  }
})
</script>

<template>
  <a-form-item>
    <div class="mb-2 text-gray-800 text-[13px] flex justify-between">
      {{ $t('labels.webhook') }}
      <a
        class="font-medium"
        href="https://docs.nocodb.com/fields/field-types/custom-types/button#create-a-button-field"
        target="_blank"
      >
        Docs
      </a>
    </div>
    <div class="flex rounded-lg">
      <NcDropdown v-model:visible="isWebHookSelectionDropdownOpen" :trigger="['click']">
        <template #overlay>
          <NcListWithSearch
            v-if="isWebHookSelectionDropdownOpen"
            :is-parent-open="isWebHookSelectionDropdownOpen"
            :search-input-placeholder="$t('placeholder.searchFields')"
            :option-config="{ selectOptionEvent: ['c:actions:webhook'], optionClassName: '' }"
            :options="manualHooks"
            :selected-option-id="selectedWebhook?.id"
            disable-mascot
            class="max-h-72 max-w-85"
            filter-field="title"
            show-selected-option
            @selected="onSelectWebhook"
          >
            <template v-if="isUIAllowed('hookCreate')" #bottom>
              <a-divider style="margin: 4px 0" />
              <div class="flex items-center text-brand-500 text-sm cursor-pointer" @click="newWebhook">
                <div class="w-full flex justify-between items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100">
                  {{ $t('general.create') }} {{ $t('objects.webhook').toLowerCase() }}
                  <GeneralIcon icon="plus" class="flex-none" />
                </div>
              </div>
            </template>
          </NcListWithSearch>
        </template>
        <div
          :class="{
            'nc-button-style-dropdown shadow-dropdown-open remove-right-shadow': isWebHookSelectionDropdownOpen,
          }"
          class="nc-button-webhook-select border-r-0 flex items-center justify-center border-1 h-8 px-[8px] border-gray-300 !w-full transition-all cursor-pointer !rounded-l-lg"
        >
          <div class="flex w-full items-center gap-2">
            <div
              :key="selectedWebhook?.id"
              class="flex items-center overflow-x-clip truncate text-ellipsis w-full gap-1 text-gray-800"
            >
              <NcTooltip
                :class="{
                  'text-gray-500': !selectedWebhook?.title,
                }"
                class="truncate max-w-full"
                show-on-truncate-only
              >
                <template #title>
                  {{ !selectedWebhook?.title ? $t('labels.selectAWebhook') : selectedWebhook?.title }}
                </template>
                {{ !selectedWebhook?.title ? $t('labels.selectAWebhook') : selectedWebhook?.title }}
              </NcTooltip>
            </div>
            <GeneralIcon
              icon="arrowDown"
              :class="{
                'transform rotate-180': isWebHookSelectionDropdownOpen,
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
          'nc-button-style-dropdown shadow-dropdown-open remove-left-shadow': isWebHookSelectionDropdownOpen,
        }"
        @click="editWebhook"
      >
        <GeneralIcon
          :class="{
            'text-gray-400': !selectedWebhook,
            'text-gray-700': selectedWebhook,
          }"
          icon="ncEdit"
        />
      </NcButton>
    </div>
  </a-form-item>

  <Webhook
    v-if="isWebhookModal"
    v-model:value="isWebhookModal"
    :hook="selectedWebhook"
    :event-list="eventList"
    @close="onClose"
  />
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
