<script setup lang="ts">
import { type AuditType } from 'nocodb-sdk'

const { user } = useGlobal()

const { primaryKey, consolidatedAudits, isAuditLoading, loadMoreAudits, resetAuditPages, mightHaveMoreAudits } =
  useExpandedFormStoreOrThrow()

const auditsWrapperEl = ref<HTMLElement | null>(null)

watch(primaryKey, () => {
  resetAuditPages()
})

function scrollToLastAudit() {
  auditsWrapperEl.value?.scrollBy({
    top: 50000,
    behavior: 'smooth',
  })
}

const createdByAudit = (
  comment: AuditType & {
    created_display_name?: string
  },
) => {
  if (comment.user === user.value?.email) {
    return 'You'
  } else if (comment.created_display_name?.trim()) {
    return comment.created_display_name || 'Shared source'
  } else if (comment.user) {
    return comment.user
  } else {
    return 'Shared source'
  }
}

const shouldSkipAuditsScroll = ref(false)

function initLoadMoreAudits() {
  shouldSkipAuditsScroll.value = true
  loadMoreAudits()
}

watch(
  consolidatedAudits,
  () => {
    if (shouldSkipAuditsScroll.value) {
      shouldSkipAuditsScroll.value = true
      return
    }
    nextTick(() => {
      setTimeout(() => {
        scrollToLastAudit()
      }, 500)
    })
  },
  {
    immediate: true,
  },
)

function safeJsonParse(json: string) {
  try {
    return JSON.parse(json)
  } catch (e) {
    return {}
  }
}

function isV0Audit(audit: AuditType) {
  if (audit.version === 0) {
    return true
  }

  if (['LINK_RECORD', 'UNLINK_RECORD'].includes(audit?.op_sub_type || '') && audit.details?.startsWith('<span')) {
    return true
  }

  return false
}
</script>

<template>
  <div class="h-full">
    <div v-if="isAuditLoading && consolidatedAudits.length === 0" class="flex flex-col items-center justify-center w-full h-full">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else ref="auditsWrapperEl" class="flex flex-col h-full nc-scrollbar-thin pb-1">
      <template v-if="consolidatedAudits.length === 0">
        <div class="flex flex-col text-center justify-center h-full">
          <div class="text-center text-3xl text-gray-600">
            <MdiHistory />
          </div>
          <div class="font-bold text-center my-1 text-gray-600">See changes to this record</div>
        </div>
      </template>
      <template v-else>
        <div class="mt-auto" />
        <div v-if="mightHaveMoreAudits" class="p-3 text-center">
          <NcButton size="small" type="secondary" @click="initLoadMoreAudits()"> Load earlier </NcButton>
        </div>
        <div v-for="audit of consolidatedAudits" :key="audit.id" :class="`${audit.id}`" class="nc-audit-item">
          <div class="group gap-3 overflow-hidden px-3 py-2 transition hover:bg-gray-100">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3 flex-1 w-full">
                <GeneralUserIcon
                  :user="{
                    email: audit?.created_by_email || audit?.user,
                    display_name: audit?.created_display_name || audit?.user,
                    meta: audit?.created_by_meta,
                  }"
                  class="mt-0.5"
                  size="medium"
                />
                <div class="flex h-[28px] items-center gap-2 w-[calc(100%_-_40px)]">
                  <div class="truncate text-gray-800 font-medium !text-small !leading-[18px] overflow-hidden">
                    {{ createdByAudit(audit) }}
                  </div>
                  <div class="text-xs text-gray-500">
                    <NcTooltip>
                      <template #title>{{ parseStringDateTime(audit.created_at) }}</template>
                      {{ timeAgo(audit.created_at!) }}
                    </NcTooltip>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="isV0Audit(audit)" class="pl-9">
              <div
                v-if="audit.details"
                v-dompurify-html="audit.details"
                class="rounded-lg border-1 border-gray-200 bg-gray-50 divide-y py-2 px-3"
              ></div>
              <div v-else class="rounded-lg border-1 border-gray-200 bg-gray-50 divide-y py-2 px-3">
                {{ audit.description }}
              </div>
            </div>
            <div v-else-if="audit?.op_type === 'DATA_INSERT'" class="pl-9">created the record.</div>
            <div v-else-if="['DATA_LINK', 'DATA_UNLINK'].includes(audit?.op_type)" class="pl-9">
              <div class="rounded-lg border-1 border-gray-200 bg-gray-50 divide-y py-2 px-3">
                <div class="flex items-center gap-2 !text-gray-600 text-xs nc-audit-mini-item-header mb-3">
                  <SmartsheetHeaderVirtualCellIcon
                    :column-meta="{ uidt: 'Links', colOptions: { type: safeJsonParse(audit.details).type } }"
                    class="!m-0"
                  />
                  {{ safeJsonParse(audit.details).link_field_title }}
                </div>
                <div class="!border-none audit-link-container">
                  <div
                    v-if="safeJsonParse(audit.details).consolidated_ref_display_values_unlinks?.length > 0"
                    class="audit-link-removal"
                  >
                    <span
                      v-for="entry of safeJsonParse(audit.details).consolidated_ref_display_values_unlinks"
                      :key="entry.refRowId"
                      class="audit-link-item"
                    >
                      {{ entry.value }}
                    </span>
                  </div>
                  <div
                    v-if="safeJsonParse(audit.details).consolidated_ref_display_values_links?.length > 0"
                    class="audit-link-addition"
                  >
                    <span
                      v-for="entry of safeJsonParse(audit.details).consolidated_ref_display_values_links"
                      :key="entry.refRowId"
                      class="audit-link-item"
                    >
                      {{ entry.value }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <template v-else-if="audit?.op_type === 'DATA_UPDATE'">
              <div class="ml-9 rounded-lg border-1 border-gray-200 bg-gray-50 divide-y">
                <SmartsheetExpandedFormSidebarAuditMiniItem :audit="audit" />
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.red.lighten-4) {
  @apply bg-red-100 rounded-md line-through;
}

.nc-audit-item {
  @apply gap-3;
}

:deep(.green.lighten-4) {
  @apply bg-green-100 rounded-md !mr-3;
}
.audit-link-container {
  @apply flex flex-row flex-wrap gap-2;
  .audit-link-addition {
    @apply flex gap-2 flex-wrap;
    span {
      @apply !text-[13px] px-1 py-0.5 text-green-700 font-weight-500 border-1 border-green-200 rounded-md bg-green-50 decoration-clone;
    }
  }
  .audit-link-removal {
    @apply flex gap-2 flex-wrap;
    span {
      @apply !text-[13px] px-1 py-0.5 text-red-700 font-weight-500 border-1 border-red-200 rounded-md bg-red-50 decoration-clone line-through;
    }
  }
}
</style>
