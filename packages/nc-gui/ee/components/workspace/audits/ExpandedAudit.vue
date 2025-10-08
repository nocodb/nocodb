<script lang="ts" setup>
import { auditV1OperationTypesAlias } from 'nocodb-sdk'
import { defineAsyncComponent } from 'vue'

// Define Monaco Editor as an async component
const MonacoEditor = defineAsyncComponent(() => import('~/components/monaco/Editor.vue'))

const auditsStore = useAuditsStore()

const { isRowExpanded, selectedAudit, bases, collaboratorsMap } = storeToRefs(auditsStore)

const isDataEventType = (audit) => {
  return !ncIsUndefined(audit?.row_id) && audit?.op_type?.startsWith('DATA_')
}

const advancedOptionsExpansionPanel = ref<string[]>([])

const selectedAuditUsername = computed(() => {
  return auditsStore.getUserName(selectedAudit.value?.user)
})

const handleUpdateAdvancedOptionsExpansionPanel = (open: boolean) => {
  if (open) {
    advancedOptionsExpansionPanel.value = ['1']
    handleAutoScroll(true, 'nc-audit-json-perview-wrapper')
  } else {
    advancedOptionsExpansionPanel.value = []
  }
}

let timer: any
function handleAutoScroll(scroll: boolean, className: string) {
  if (scroll) {
    if (timer) {
      clearTimeout(timer)
    }

    nextTick(() => {
      const el = document.querySelector(`.nc-expanded-audit .${className}`)

      if (!el) return

      // wait for transition complete
      timer = setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 400)
    })
  }
}
</script>

<template>
  <NcModal v-model:visible="isRowExpanded" size="sm" height="auto" :show-separator="false" @keydown.esc="isRowExpanded = false">
    <template #header>
      <div class="flex items-center justify-between gap-x-2 w-full">
        <div class="flex-1 text-base font-weight-700 text-gray-900">Audit Details</div>
        <div class="flex items-center gap-2">
          <NcTooltip placement="bottom" class="text-nc-content-gray-subtle2 text-small leading-[18px]">
            <template #title> {{ parseStringDateTime(selectedAudit.created_at, 'D MMMM YYYY HH:mm') }}</template>

            {{ timeAgo(selectedAudit.created_at) }}
          </NcTooltip>
        </div>
      </div>
    </template>
    <div v-if="selectedAudit" class="nc-expanded-audit flex flex-col gap-4">
      <div class="bg-gray-50 rounded-lg border-1 border-gray-200">
        <div class="flex">
          <div class="w-1/2 border-r border-gray-200 flex flex-col gap-2 px-4 py-3">
            <div class="cell-header">Performed by</div>
            <div
              v-if="selectedAudit?.user && collaboratorsMap.get(selectedAudit.user)?.email"
              class="w-full flex gap-3 items-center"
            >
              <GeneralUserIcon :user="collaboratorsMap.get(selectedAudit.user)" size="base" class="flex-none" />
              <div class="flex-1 flex flex-col">
                <div class="w-full flex gap-3">
                  <span class="text-sm text-gray-800 capitalize font-semibold">
                    {{ selectedAuditUsername }}
                  </span>
                </div>
                <span class="text-xs text-gray-600">
                  {{ collaboratorsMap.get(selectedAudit.user)?.email }}
                </span>
              </div>
            </div>

            <div v-else class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.user }}</div>
          </div>

          <div class="w-1/2">
            <div class="h-1/2 border-b border-gray-200 flex items-center gap-2 px-4 py-3">
              <div class="cell-header">{{ $t('general.ipAddress') }}</div>
              <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.ip === '::1' ? 'localhost' : '' }}</div>
            </div>
            <div class="h-1/2 flex items-center gap-2 px-4 py-3">
              <div class="cell-header whitespace-nowrap">{{ $t('labels.osBrowser') }}</div>
              <NcTooltip class="truncate" placement="bottom" show-on-truncate-only>
                <template #title> {{ selectedAudit?.user_agent ?? 'N/A' }}</template>

                <span class="text-small leading-[18px] text-gray-600">
                  {{ selectedAudit?.user_agent ?? 'N/A' }}
                </span>
              </NcTooltip>
            </div>
          </div>
        </div>
        <div class="border-t-1 border-gray-200 flex">
          <div class="w-1/2 border-r border-gray-200 flex flex-col gap-2 px-4 py-3">
            <div class="cell-header">{{ $t('objects.project') }}</div>
            <div v-if="selectedAudit?.base_id && bases.get(selectedAudit?.base_id)" class="flex items-stretch gap-3">
              <div class="flex items-center">
                <GeneralProjectIcon
                  :color="bases.get(selectedAudit?.base_id)?.meta?.iconColor"
                  :type="bases.get(selectedAudit?.base_id)?.type || 'database'"
                  class="nc-view-icon w-5 h-5"
                />
              </div>
              <div>
                <div class="text-sm font-weight-500 text-gray-900">{{ bases.get(selectedAudit?.base_id)?.title }}</div>
                <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.base_id }}</div>
              </div>
            </div>
            <template v-else>
              {{ selectedAudit.base_id }}
            </template>
          </div>
          <div class="w-1/2">
            <div :class="selectedAudit?.base_id ? 'h-1/2' : 'h-full'" class="flex items-center gap-2 px-4 py-3">
              <div class="cell-header">{{ $t('general.event') }}</div>
              <div class="text-small leading-[18px] text-gray-600">
                {{ auditV1OperationTypesAlias[selectedAudit?.op_type] }}
              </div>
            </div>
            <div v-if="isDataEventType(selectedAudit)" class="h-1/2 flex items-center gap-2 px-4 py-3 border-t border-gray-200">
              <div class="cell-header">{{ $t('labels.rowId') }}</div>
              <div class="text-small leading-[18px] text-gray-600">
                {{ selectedAudit?.row_id }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <a-collapse v-model:active-key="advancedOptionsExpansionPanel" ghost class="nc-audit-json-perview-wrapper">
        <template #expandIcon="{ isActive }">
          <NcButton
            type="text"
            size="small"
            @click="handleUpdateAdvancedOptionsExpansionPanel(!advancedOptionsExpansionPanel.length)"
          >
            <div class="text-sm">{{ $t('labels.showJsonPayload') }}</div>

            <GeneralIcon
              icon="chevronDown"
              class="ml-2 flex-none cursor-pointer transform transition-transform duration-500"
              :class="{ '!rotate-180': isActive }"
            />
          </NcButton>
        </template>
        <a-collapse-panel key="1" collapsible="disabled">
          <template #header>
            <span></span>
          </template>

          <div class="border-1 border-gray-200 !rounded-lg shadow-sm overflow-hidden">
            <Suspense>
              <template #default>
                <MonacoEditor
                  :model-value="selectedAudit?.details || ''"
                  read-only
                  class="nc-audit-json-perview h-[200px] w-full"
                />
              </template>
              <template #fallback>
                <div class="h-[200px] w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                  <div class="text-center">
                    <a-spin size="large" />
                    <div class="mt-4 text-gray-600 dark:text-gray-400">
                      Loading Monaco Editor...
                    </div>
                  </div>
                </div>
              </template>
            </Suspense>
          </div>
        </a-collapse-panel>
      </a-collapse>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.cell-header {
  @apply text-xs font-semibold text-gray-500;
}

.nc-audit-json-perview-wrapper {
  :deep(.ant-collapse-header) {
    @apply !p-0 flex items-center !cursor-default children:first:flex;
  }
  :deep(.ant-collapse-content-box) {
    @apply !px-0 !pb-0 !pt-3;
  }
}

.nc-audit-json-perview {
  @apply min-h-[200px] max-h-[400px] resize-y overflow-y-auto;
}

.nc-expanded-audit pre {
  font-family: Inter, Manrope, 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
}
</style>
