<script setup lang="ts">
import type { AuditType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  auditGroup: { audit: AuditType; user: string; displayName: string }
}>()

const { user } = useGlobal()

/* fields */

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

/* formatting */

const createdBy = computed(() => {
  if (props.auditGroup.user === user.value?.email) {
    return 'You'
  } else if (props.auditGroup.displayName?.trim()) {
    return props.auditGroup.displayName.trim() || 'Shared source'
  } else if (props.auditGroup.displayName) {
    return props.auditGroup.displayName
  } else {
    return 'Shared source'
  }
})

</script>

<template>
  <div class="py-4 mx-6 border-l border-gray-300">
    <div class="flex items-center h-[32px] gap-3 mb-3">
      <div class="w-[28px] h-[28px] bg-white flex items-center justify-center bg-white rounded-full border border-1 !border-gray-200 shadow-sm -ml-3.5">
        <GeneralIcon
          icon="ncPenLine"
          class="w-[16px] h-[16px] text-gray-500"
        />
      </div>
      <GeneralUserIcon
        :user="{
          email: props.auditGroup.user,
          display_name: props.auditGroup.displayName,
        }"
        class="w-[24px] aspect-square"
      />
      <p class="text-[13px] mb-0">
        <span class="font-weight-700">
          {{ createdBy }}
        </span>
        <span v-if="props.auditGroup.audit?.op_type === 'DATA_INSERT'" class="font-weight-500 text-gray-600"> created a record. </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_UPDATE'" class="font-weight-500 text-gray-600"> updated {{ fieldsChanged }} fields </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_LINK'" class="font-weight-500 text-gray-600">
          linked table "{{ safeGetFromAuditDetails(props.auditGroup.audit, 'table_title') }}" to "{{
            safeGetFromAuditDetails(props.auditGroup.audit, 'ref_table_title')
          }}"
        </span>
      </p>
      <div class="text-xs font-weight-500 text-gray-500">
        {{ timeAgo(props.auditGroup.audit?.created_at) }}
      </div>
    </div>
    <template v-if="props.auditGroup.audit?.op_type === 'DATA_INSERT'">
      <div class="relative mb-2">
        <GeneralIcon
          icon="ncNode"
          class="w-[16px] h-[16px] text-gray-500 bg-white absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <p class="text-sm font-weight-500 mb-1 ml-6.5">Record was created.</p>
      </div>
    </template>
    <template v-else-if="props.auditGroup.audit?.op_type === 'DATA_UPDATE'">
      <SmartsheetExpandedFormPresentorsDiscussionAuditInfoExpressive :audit="props.auditGroup.audit" />
    </template>
    <template v-else-if="props.auditGroup.audit?.op_type === 'DATA_LINK'">
      <div class="relative mb-2">
        <GeneralIcon
          icon="ncNode"
          class="w-[16px] h-[16px] text-gray-500 bg-white absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <p class="text-sm mb-1 ml-6.5">
          "{{ safeGetFromAuditDetails(props.auditGroup.audit, 'link_field_title') }}" field was linked to row
          {{ safeGetFromAuditDetails(props.auditGroup.audit, 'ref_row_id') }}
          with value "{{ safeGetFromAuditDetails(props.auditGroup.audit, 'ref_display_value') }}"
        </p>
      </div>
    </template>
  </div>
</template>
