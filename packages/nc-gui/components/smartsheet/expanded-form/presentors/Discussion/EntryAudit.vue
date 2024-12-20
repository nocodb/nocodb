<script setup lang="ts">
import type { AuditType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  auditGroup: { audit: AuditType; user: string; displayName: string }
}>()

const fieldsChanged = computed(() => {
  try {
    return Object.keys(JSON.parse(props.auditGroup.audit.details || '').data).length
  } catch {
    return '-'
  }
})

function safeGetFromAuditDetails(audit: AuditType, key: string) {
  try {
    return JSON.parse(audit.details || '')[key]
  } catch {
    return '-'
  }
}
</script>

<template>
  <div class="py-4 mx-6 border-l border-gray-200">
    <div class="flex items-center h-[32px] gap-2 mb-3">
      <GeneralIcon
        icon="pencil"
        class="w-[28px] h-[28px] p-1 text-gray-500 bg-white rounded-full border border-1 border-gray-300 shadow -ml-3.5"
      />
      <GeneralUserIcon :email="props.auditGroup.user" class="w-[24px] aspect-square ml-1" />
      <p class="text-sm font-medium mb-0">
        {{ props.auditGroup.displayName }}
        <span v-if="props.auditGroup.audit?.op_type === 'DATA_INSERT'"> created a record. </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_UPDATE'"> updated {{ fieldsChanged }} fields </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_LINK'">
          linked table "{{ safeGetFromAuditDetails(props.auditGroup.audit, 'table_title') }}" to "{{
            safeGetFromAuditDetails(props.auditGroup.audit, 'ref_table_title')
          }}"
        </span>
      </p>
      <div class="text-xs text-gray-500">
        {{ timeAgo(props.auditGroup.audit?.created_at) }}
      </div>
    </div>
    <template v-if="props.auditGroup.audit?.op_type === 'DATA_INSERT'">
      <div class="relative mb-2">
        <GeneralIcon
          icon="ncLink"
          class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <p class="text-sm mb-1 ml-6.5">Record was created.</p>
      </div>
    </template>
    <template v-else-if="props.auditGroup.audit?.op_type === 'DATA_UPDATE'">
      <SmartsheetExpandedFormPresentorsDiscussionAuditInfoExpressive :audit="props.auditGroup.audit" />
    </template>
    <template v-else-if="props.auditGroup.audit?.op_type === 'DATA_LINK'">
      <div class="relative mb-2">
        <GeneralIcon
          icon="ncLink"
          class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <p class="text-sm mb-1 ml-6.5">
          "{{ safeGetFromAuditDetails(props.auditGroup.audit, 'link_field_title') }}" field was linked to row
          {{ safeGetFromAuditDetails(props.auditGroup.audit, 'ref_row_id') }}
          with value "{{ safeGetFromAuditDetails(props.auditGroup.audit, 'ref_display_value') }}"
        </p>
      </div>
    </template>
    <template v-else>
      <!-- {{ props.auditGroup.audit }} -->
    </template>
  </div>
</template>
