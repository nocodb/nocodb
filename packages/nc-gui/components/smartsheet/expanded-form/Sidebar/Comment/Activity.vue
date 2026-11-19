<script setup lang="ts">
import type { AuditType } from 'nocodb-sdk'

const props = defineProps<{
  audit: AuditType & { created_at?: string; created_display_name_short?: string; fk_user_id?: string }
}>()

const { t } = useI18n()

const { user } = useGlobal()

const UPDATE_OP_TYPES = ['DATA_UPDATE', 'DATA_BULK_UPDATE', 'DATA_BULK_ALL_UPDATE', 'DATA_CASCADE_UPDATE']

const isOpen = ref(false)

const details = computed<Record<string, any>>(() => {
  try {
    return JSON.parse(props.audit.details as string) ?? {}
  } catch {
    return {}
  }
})

const isUpdate = computed(() => UPDATE_OP_TYPES.includes(props.audit.op_type as string))

const actor = computed(() => {
  if (props.audit.fk_user_id && props.audit.fk_user_id === user.value?.id) return t('general.you')
  return props.audit.created_display_name_short?.trim() || props.audit.user || t('labels.sharedSource')
})

const summary = computed(() => {
  const opType = props.audit.op_type as string

  if (isUpdate.value) {
    const fields = Object.keys(details.value.data ?? {})
    if (fields.length) return t('activity.commentThread.changedFields', { fields: fields.join(', ') })
  }

  if (opType === 'DATA_INSERT') return t('activity.commentThread.createdRecord')

  if (opType === 'DATA_LINK' || opType === 'DATA_UNLINK') {
    return t('activity.commentThread.updatedLinks', { field: details.value.link_field_title ?? '' })
  }

  return t('activity.commentThread.updatedRecord')
})
</script>

<template>
  <div class="nc-comment-activity px-3 py-1" data-testid="nc-comment-activity">
    <button
      type="button"
      class="flex w-full items-start gap-2 text-left text-xs text-nc-content-gray-muted"
      :class="isUpdate ? 'cursor-pointer hover:text-nc-content-gray-subtle' : 'cursor-default'"
      :disabled="!isUpdate"
      @click="isOpen = !isOpen"
    >
      <span class="flex h-6 w-6 flex-none items-center justify-center">
        <GeneralIcon icon="ncEdit" class="w-3.5 h-3.5" />
      </span>
      <span class="min-w-0 flex-1 py-0.75 leading-[18px]">
        <span class="font-semibold text-nc-content-gray-subtle">{{ actor }}</span>
        {{ summary }}
      </span>
      <span class="flex-none py-0.75 leading-[18px]">{{ timeAgo(audit.created_at!) }}</span>
    </button>
    <div v-if="isOpen && isUpdate" class="pl-8 pt-1">
      <SmartsheetExpandedFormSidebarAuditMiniItem :audit="audit" />
    </div>
  </div>
</template>
