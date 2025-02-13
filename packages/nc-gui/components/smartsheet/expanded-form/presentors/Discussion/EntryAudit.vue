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
  <div class="py-4 ml-7 mr-6 border-l border-gray-300">
    <div class="flex items-center h-[32px] gap-2 mb-2">
      <div
        class="w-[28px] h-[28px] bg-white flex items-center justify-center bg-white rounded-full border border-1 !border-gray-200 shadow-sm -ml-3.5"
      >
        <GeneralIcon icon="ncPenLine" class="w-[16px] h-[16px] text-gray-500" />
      </div>
      <GeneralUserIcon
        :user="{
          email: props.auditGroup.user,
          display_name: props.auditGroup.displayName,
          meta: props.auditGroup.audit?.created_by_meta,
        }"
        class="w-[24px] aspect-square"
      />
      <p class="text-[13px] mb-0">
        <span class="font-weight-700">
          {{ createdBy }}
        </span>
        <span v-if="props.auditGroup.audit?.op_type === 'DATA_INSERT'" class="font-weight-500 text-gray-600">
          created a record.
        </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_UPDATE'" class="font-weight-500 text-gray-600">
          updated {{ fieldsChanged }} fields
        </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_LINK'" class="font-weight-500 text-gray-600">
          updated 1 field
        </span>
      </p>
      <div class="text-xs font-weight-500 text-gray-500">
        <NcTooltip>
          <template #title>{{ parseStringDateTime(props.auditGroup.audit?.created_at) }}</template>
          {{ timeAgo(props.auditGroup.audit?.created_at) }}
        </NcTooltip>
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
    <template v-else-if="['DATA_LINK', 'DATA_UNLINK'].includes(props.auditGroup.audit?.op_type)">
      <div class="relative mb-2">
        <GeneralIcon
          icon="ncNode"
          class="w-[16px] h-[16px] text-gray-500 bg-white absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <p class="text-sm mb-1 ml-6.5 inline-flex items-center flex-wrap mt-1">
          <span class="text-[13px] text-gray-600 font-weight-500"> changed </span>
          <span class="border-1 border-gray-300 rounded-md px-1 !h-[20px] bg-gray-200 inline-flex items-center gap-1 mx-1">
            <SmartsheetHeaderVirtualCellIcon
              :column-meta="{ uidt: 'Links', colOptions: { type: safeGetFromAuditDetails(props.auditGroup.audit, 'type') } }"
              class="!w-[16px] !h-[16px] !m-0"
            />
            <span class="text-[13px] font-weight-500 text-gray-600">
              {{ safeGetFromAuditDetails(props.auditGroup.audit, 'link_field_title') }}
            </span>
          </span>
          <div
            v-if="safeGetFromAuditDetails(props.auditGroup.audit, 'consolidated_ref_display_values_unlinks')?.length > 0"
            class="flex gap-1 flex-wrap mr-1"
          >
            <span
              class="!text-[13px] p-0.5 font-weight-500 border-1 border-red-200 rounded-md bg-red-50 inline-flex items-center gap-1"
            >
              <span
                v-for="entry of safeGetFromAuditDetails(props.auditGroup.audit, 'consolidated_ref_display_values_unlinks')"
                :key="entry.refRowId"
                class="text-brand-500 font-weight-500 line-through px-1 bg-[#F0F3FF] !rounded-md"
              >
                {{ entry.value }}
              </span>
            </span>
          </div>
          <div
            v-if="safeGetFromAuditDetails(props.auditGroup.audit, 'consolidated_ref_display_values_links')?.length > 0"
            class="flex gap-1 flex-wrap"
          >
            <span
              class="!text-[13px] p-0.5 font-weight-500 border-1 border-green-200 rounded-md bg-green-50 inline-flex items-center gap-1"
            >
              <span
                v-for="entry of safeGetFromAuditDetails(props.auditGroup.audit, 'consolidated_ref_display_values_links')"
                :key="entry.refRowId"
                class="text-brand-500 font-weight-500 px-1 bg-[#F0F3FF] !rounded-md"
              >
                {{ entry.value }}
              </span>
            </span>
          </div>
        </p>
      </div>
    </template>
  </div>
</template>
