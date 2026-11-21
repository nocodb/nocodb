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

const { agents } = storeToRefs(useAgentStore())

const { t } = useI18n()

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
    return t('general.you')
  } else if (displayName) {
    return displayName || t('labels.sharedSource')
  } else {
    return t('labels.sharedSource')
  }
})
</script>

<template>
  <div class="py-4 ml-15.8 rtl:(mr-15.8 ml-0 border-l-0 border-r) border-l border-nc-border-gray-dark">
    <div class="flex items-center h-[32px] gap-2 mb-2">
      <div
        class="w-[28px] h-[28px] bg-nc-bg-elevated flex items-center justify-center bg-nc-bg-elevated rounded-full border border-1 !border-nc-border-gray-medium shadow-sm -ml-3.5 rtl:(-mr-3.5 ml-0)"
      >
        <GeneralIcon icon="ncPenLine" class="w-[16px] h-[16px] text-nc-content-gray-muted" />
      </div>
      <GeneralUserIcon
        :user="{
          email: props.auditGroup.user,
          display_name: props.auditGroup.displayName,
          meta: props.auditGroup.audit?.created_by_meta,
        }"
        class="w-[28px] h-[28px] aspect-square"
      />
      <p class="text-small1 mb-0">
        <!-- mr-1: Vue's whitespace condense drops the newline between the two
             spans, fusing "User" into the action text ("Usercreated a record") -->
        <span class="font-weight-700 mr-1 rtl:(mr-0 ml-1)">
          {{ createdBy }}
        </span>
        <span v-if="auditAgent(props.auditGroup.audit, agents)" class="mr-1 rtl:(mr-0 ml-1) text-nc-content-gray-muted">
          {{
            auditAgent(props.auditGroup.audit, agents)?.title
              ? $t('labels.agentPersonal.viaAgent', { agent: auditAgent(props.auditGroup.audit, agents)?.title })
              : $t('labels.agentPersonal.viaAnAgent')
          }}
        </span>
        <span v-if="props.auditGroup.audit?.op_type === 'DATA_INSERT'" class="font-weight-500 text-nc-content-gray-subtle2">
          {{ $t('activity.createdARecord') }}
        </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_UPDATE'" class="font-weight-500 text-nc-content-gray-subtle2">
          {{ $t('activity.updatedFields', { fieldsChanged }) }}
        </span>
        <span
          v-else-if="props.auditGroup.audit?.op_type === 'DATA_CASCADE_UPDATE'"
          class="font-weight-500 text-nc-content-gray-subtle2"
        >
          {{ $t('labels.dateDependency.cascadeUpdateDescription') }}
        </span>
        <span v-else-if="props.auditGroup.audit?.op_type === 'DATA_LINK'" class="font-weight-500 text-nc-content-gray-subtle2">
          {{ $t('activity.updatedOneField') }}
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
          class="w-[16px] h-[16px] text-nc-content-gray-muted bg-nc-bg-elevated absolute top-1/2 left-0 rtl:(left-auto right-0 translate-x-1/2) transform -translate-y-1/2 -translate-x-1/2"
        />
        <p class="text-sm font-weight-500 mb-1 ml-6.5">{{ $t('activity.recordWasCreated') }}</p>
      </div>
    </template>
    <div
      v-else-if="['DATA_UPDATE', 'DATA_CASCADE_UPDATE'].includes(props.auditGroup.audit?.op_type)"
      class="nc-audit-card ml-6.5 rtl:(mr-6.5 ml-0) flex flex-col gap-3"
    >
      <SmartsheetExpandedFormSidebarAuditMiniItem :audit="props.auditGroup.audit" />
    </div>
    <div
      v-else-if="['DATA_LINK', 'DATA_UNLINK'].includes(props.auditGroup.audit?.op_type)"
      class="nc-audit-card ml-6.5 rtl:(mr-6.5 ml-0)"
    >
      <div
        class="!text-nc-content-gray-subtle2 uppercase !text-[10px] tracking-wide font-weight-500 nc-audit-mini-item-header truncate"
      >
        {{ safeGetFromAuditDetails(props.auditGroup.audit, 'link_field_title') }}
      </div>
      <div class="mt-1 flex flex-wrap items-center gap-1.5 text-small1">
        <span
          v-for="entry of safeGetFromAuditDetails(props.auditGroup.audit, 'consolidated_ref_display_values_links') || []"
          :key="`a-${entry.refRowId}`"
          class="nc-audit-record"
        >
          <span class="nc-audit-pm nc-audit-pm-plus">+</span>{{ entry.value }}
        </span>
        <span
          v-for="entry of safeGetFromAuditDetails(props.auditGroup.audit, 'consolidated_ref_display_values_unlinks') || []"
          :key="`r-${entry.refRowId}`"
          class="nc-audit-record nc-audit-record-gone"
        >
          <span class="nc-audit-pm nc-audit-pm-minus">−</span><span class="line-through">{{ entry.value }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-audit-card {
  @apply rounded-lg border-1 border-nc-border-gray-light bg-nc-bg-gray-extralight py-2.5 px-3 min-w-0;
}

.nc-audit-record {
  @apply inline-flex items-center gap-1 px-1.5 rounded-md border-1 border-nc-border-gray-medium bg-nc-bg-default text-nc-content-gray leading-5;
}
.nc-audit-record-gone {
  opacity: 0.55;
}

.nc-audit-pm {
  @apply flex-none text-xs font-bold;
}
.nc-audit-pm-plus {
  @apply text-nc-content-green-dark;
}
.nc-audit-pm-minus {
  @apply text-nc-content-red-dark;
}
</style>
