<script setup lang="ts">
import { ButtonActionsType, type ButtonType, type ColumnType, hasInputCalls, isActionButtonCol } from 'nocodb-sdk'

const open = ref(false)

const { isMobileMode } = useGlobal()

const { isPanelExpanded: isActionPaneActive } = useActionPane()

const isLocked = inject(IsLockedInj, ref(false))

const { view, meta } = useSmartsheetStoreOrThrow()
const { isUIAllowed } = useRoles()
const { hooks } = useWebhooksStore()

const buttonActionColumns = computed(() => {
  return (meta.value?.columns ?? []).filter((col) => isActionButtonCol(col)) as (ColumnType & {
    colOptions: ButtonType
  })[]
})

useMenuCloseOnEsc(open)

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const activeActionPane = () => {
  isActionPaneActive.value = true
  open.value = false
}

const { loadAutomation } = useAutomationStore()

const executionStatus = ref(
  new Map<
    string,
    {
      status: 'loading' | 'success' | 'error'
    }
  >(),
)

const buttonInputStatus = ref(new Map<string, { hasInputCalls: boolean; isLoading: boolean }>())

const loadButtonAutomations = async () => {
  for (const button of buttonActionColumns.value) {
    if (button.colOptions.type === ButtonActionsType.Script && button.colOptions.fk_script_id && button.id) {
      buttonInputStatus.value.set(button.id, { hasInputCalls: false, isLoading: true })

      try {
        const automation = await loadAutomation(button.colOptions.fk_script_id)
        if (automation?.script) {
          const hasInput = hasInputCalls(automation.script)
          buttonInputStatus.value.set(button.id, { hasInputCalls: hasInput, isLoading: false })
        } else {
          buttonInputStatus.value.set(button.id, { hasInputCalls: false, isLoading: false })
        }
      } catch (error) {
        buttonInputStatus.value.set(button.id, { hasInputCalls: false, isLoading: false })
      }
    } else if (button.colOptions.type === ButtonActionsType.Webhook && button.colOptions.fk_webhook_id && button.id) {
      buttonInputStatus.value.set(button.id, { hasInputCalls: false, isLoading: true })
      
      try {
        const webhookExists = hooks.some((hook: any) => hook.id === button.colOptions.fk_webhook_id)
        
        if (webhookExists) {
          buttonInputStatus.value.set(button.id, { hasInputCalls: false, isLoading: false })
        } else {
          buttonInputStatus.value.set(button.id, { hasInputCalls: true, isLoading: false })
        }
      } catch (error) {
        buttonInputStatus.value.set(button.id, { hasInputCalls: true, isLoading: false })
      }
    }
  }
}

const isButtonDisabled = (button: ColumnType & { colOptions: ButtonType }) => {
  const status = buttonInputStatus.value.get(button.id!)
  
  if (button.colOptions.type === ButtonActionsType.Webhook && !isUIAllowed('hookTrigger')) {
    return true
  }
  
  return (
    executionStatus.value.get(button.id!)?.status === 'loading' ||
    status?.isLoading ||
    status?.hasInputCalls
  )
}

const getTooltipMessage = (button: ColumnType & { colOptions: ButtonType }) => {
  if (button.colOptions.type === ButtonActionsType.Webhook && !isUIAllowed('hookTrigger')) {
    return 'You do not have permission to trigger webhooks.'
  }
  if (button.colOptions.type === ButtonActionsType.Script && buttonInputStatus.value.get(button.id!)?.hasInputCalls) {
    return 'This script requires user input and cannot be run as a bulk action. Please execute it from individual records instead.'
  }
  if (button.colOptions.type === ButtonActionsType.Webhook && buttonInputStatus.value.get(button.id!)?.hasInputCalls) {
    return 'This webhook is not available.'
  }
  return ''
}

const shouldShowTooltip = (button: ColumnType & { colOptions: ButtonType }) => {
  return isButtonDisabled(button) && getTooltipMessage(button) !== ''
}

watch(
  () => buttonActionColumns.value.length,
  () => {
    loadButtonAutomations()
  },
  { immediate: true },
)

const executeAction = async (
  button: ColumnType & {
    colOptions: ButtonType
  },
) => {
  // Execute Action
}
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    :trigger="['click']"
    class="!xs:hidden"
    overlay-class-name="nc-dropdown-action-menu nc-toolbar-dropdown overflow-hidden"
  >
    <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode">
      <template #title>
        {{ $t('activity.sort') }}
      </template>
      <NcButton
        v-e="['c:execute:action']"
        class="nc-action-menu-btn nc-toolbar-btn !h-7 !border-0"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-1 min-h-5">
          <div class="flex items-center gap-2">
            <component :is="iconMap.ncPlay" class="h-4 w-4 text-inherit" />
            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">{{
              $t('activity.runActions')
            }}</span>
          </div>
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div
        :class="{
          'nc-locked-view': isLocked,
        }"
      >
        <div class="pt-2 pb-2 nc-action-list max-h-[max(80vh,30rem)] min-w-102" data-testid="nc-actions-menu">
          <div v-for="button in buttonActionColumns" :key="button.id" class="px-3 flex pb-2">
            <NcTooltip class="w-full" :disabled="!shouldShowTooltip(button)" placement="right">
              <template #title>
                <span>{{ getTooltipMessage(button) }}</span>
              </template>
              <NcButton
                :disabled="isButtonDisabled(button)"
                class="w-full"
                type="secondary"
                full-width
                size="small"
                :loading="executionStatus.get(button.id)?.status === 'loading' || buttonInputStatus.get(button.id)?.isLoading"
                @click="executeAction(button)"
              >
                <div class="flex gap-2 w-full items-center">
                  <GeneralIcon v-if="button.colOptions.icon" :icon="button.colOptions.icon" class="!w-4 min-w-4 min-h-4 !h-4" />
                  <div class="flex flex-col items-start">
                    {{ button.colOptions.label }}
                  </div>
                </div>

                <div class="flex-1" />
              </NcButton>
            </NcTooltip>
          </div>
          <NcDivider />
          <div class="px-2">
            <NcButton full-width class="w-full" type="text" size="small" @click="activeActionPane">
              <div class="flex items-center !w-full gap-2">
                <GeneralIcon icon="ncList" />
                {{ $t('labels.actionLogs') }}
              </div>
            </NcButton>
          </div>
        </div>

        <GeneralLockedViewFooter v-if="isLocked" class="-mt-2" @on-open="open = false" />
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.new-btn-action {
  .nc-btn-inner {
    @apply justify-start !w-full;
  }
}
</style>
