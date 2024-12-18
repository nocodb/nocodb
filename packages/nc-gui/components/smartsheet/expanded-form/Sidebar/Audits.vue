<script setup lang="ts">
import { type AuditType } from 'nocodb-sdk'

const { user } = useGlobal()


const { audits, isAuditLoading } = useExpandedFormStoreOrThrow()

const auditsWrapperEl = ref<HTMLElement | null>(null)

function scrollToAudit(auditId?: string) {
  if (!auditId) return

  const auditEl = auditsWrapperEl.value?.querySelector(`.nc-audit-item.${auditId}`)
  if (auditEl) {
    auditEl.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }
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

watch(
  () => audits.value.length,
  (auditCount) => {
    nextTick(() => {
      setTimeout(() => {
        scrollToAudit(audits.value[auditCount - 1]?.id)
      }, 100)
    })
  },
)

</script>

<template>
  <div class="h-full">
    <div v-if="isAuditLoading" class="flex flex-col items-center justify-center w-full h-full">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else ref="auditsWrapperEl" class="flex flex-col h-full nc-scrollbar-thin">
      <template v-if="audits.length === 0">
        <div class="flex flex-col text-center justify-center h-full">
          <div class="text-center text-3xl text-gray-600">
            <MdiHistory />
          </div>
          <div class="font-bold text-center my-1 text-gray-600">See changes to this record</div>
        </div>
      </template>
      <template v-else>
        <div class="mt-auto" />
        <div v-for="audit of audits" :key="audit.id" :class="`${audit.id}`" class="nc-audit-item">
          <div class="group gap-3 overflow-hidden px-3 py-2 hover:bg-gray-100">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3 flex-1 w-full">
                <GeneralUserIcon :email="audit?.created_by_email" :name="audit?.created_display_name" class="mt-0.5" size="medium" />
                <div class="flex h-[28px] items-center gap-2 w-[calc(100%_-_40px)]">
                  <div class="truncate text-gray-800 font-medium !text-small !leading-[18px] overflow-hidden">
                    {{ createdByAudit(audit) }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ timeAgo(audit.created_at!) }}
                  </div>
                </div>
              </div>
            </div>
            <div v-if="audit?.op_type === 'DATA_INSERT'" class="pl-9">
              created a record.
            </div>
            <div v-else-if="audit?.op_type === 'DATA_LINK'" class="pl-9">
              linked table
              "{{ JSON.parse(audit.details)?.table_title }}"
              to
              "{{ JSON.parse(audit.details)?.ref_table_title }}"
            </div>
            <template v-else-if="audit?.op_type === 'DATA_UPDATE'">
              <div class="ml-9 rounded-lg border-1 border-gray-300 bg-gray-50 divide-y">
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
</style>
