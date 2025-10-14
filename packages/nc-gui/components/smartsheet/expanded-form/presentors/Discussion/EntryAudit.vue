<script setup lang="ts">
import type { AuditType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  auditGroup: {
    audit: AuditType
    user: string
    displayName?: string
    displayNameShort?: string
    created_display_name?: string
    created_display_name_short?: string
  }
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
  const displayName = props.auditGroup.displayNameShort?.trim() || props.auditGroup.created_display_name_short?.trim()
  if (props.auditGroup.user === user.value?.email) {
    return 'You'
  } else if (displayName) {
    return displayName || 'Shared source'
  } else {
    return 'Shared source'
  }
})
</script>

<template>
  <div class="py-4 ml-15.8 border-l border-nc-border-gray-dark">
    <div class="flex items-center h-[32px] gap-2 mb-2">
      <div
        class="w-[28px] h-[28px] bg-nc-bg-default flex items-center justify-center bg-nc-bg-default rounded-full border border-1 !border-nc-border-gray-medium shadow-sm -ml-3.5"
      >
        <GeneralIcon icon="ncPenLine" class="w-[16px] h-[16px] text-nc-content-gray-muted" />
      </div>
      <GeneralUserIcon
        :user="{
          email: props.auditGroup.user,
          display_name: props.auditGroup.displayName,
          meta: props.auditGroup.audit?.created_by_meta,
        }"
        class="w-[24px] aspect-square"
      />
      <p class="text-small1 mb-0">
        <span class="font-weight-700">
          {{ createdBy }}
        </span>
        <span v-if="props.auditGroup.audit?.op_type === 'DATA_INSERT'" class="font-weight-500 text-nc-content-gray-subtle2">
          created a record.
        </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_UPDATE'" class="font-weight-500 text-nc-content-gray-subtle2">
          updated {{ fieldsChanged }} fields
        </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_LINK'" class="font-weight-500 text-nc-content-gray-subtle2">
          updated 1 field
        </span>
      </p>
      <div class="text-xs font-weight-500 text-nc-content-gray-muted">
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
          class="w-[16px] h-[16px] text-nc-content-gray-muted bg-nc-bg-default absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
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
          class="w-[16px] h-[16px] text-nc-content-gray-muted bg-nc-bg-default absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <div class="text-sm ml-6.5 inline-flex items-center flex-wrap gap-1">
          <span class="text-small1 text-nc-content-gray-subtle2 font-weight-500"> changed </span>
          <span
            class="rounded-md px-1 !h-[20px] inline-flex items-center gap-1 text-nc-content-gray-emphasis border-1 border-nc-border-gray-medium"
          >
            <SmartsheetHeaderVirtualCellIcon
              :column-meta="{ uidt: 'Links', colOptions: { type: safeGetFromAuditDetails(props.auditGroup.audit, 'type') } }"
              class="!w-[16px] !h-[16px] !m-0"
            />
            <span class="text-small1 font-weight-500">
              {{ safeGetFromAuditDetails(props.auditGroup.audit, 'link_field_title') }}
            </span>
          </span>
          <div
            v-if="safeGetFromAuditDetails(props.auditGroup.audit, 'consolidated_ref_display_values_unlinks')?.length > 0"
            class="flex gap-1 flex-wrap"
          >
            <span
              class="!text-small p-0.5 font-weight-500 border-1 border-nc-red-200 rounded-md bg-nc-bg-red-light inline-flex items-center gap-1"
            >
              <span
                v-for="entry of safeGetFromAuditDetails(props.auditGroup.audit, 'consolidated_ref_display_values_unlinks')"
                :key="entry.refRowId"
                class="text-nc-content-brand font-weight-500 line-through px-1 bg-nc-bg-brand !rounded-md"
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
              class="!text-small1 p-0.5 font-weight-500 border-1 border-nc-green-200 rounded-md bg-nc-bg-green-light inline-flex items-center gap-1"
            >
              <span
                v-for="entry of safeGetFromAuditDetails(props.auditGroup.audit, 'consolidated_ref_display_values_links')"
                :key="entry.refRowId"
                class="text-nc-content-brand font-weight-500 px-1 bg-nc-bg-brand !rounded-md"
              >
                {{ entry.value }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
