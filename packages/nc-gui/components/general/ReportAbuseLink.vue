<script setup lang="ts">
interface Props {
  /** Defaults to the page's registered target (`useAbuseReportTarget`). */
  target?: AbuseReportTarget
  /** Show only a flag icon in mobile mode, where the topbar is crowded. */
  iconOnlyMobile?: boolean
}

const props = defineProps<Props>()

// Two roots (link + modal): forward class/style to the link explicitly.
defineOptions({ inheritAttrs: false })

const { appInfo } = useGlobal()

const { isMobileMode } = storeToRefs(useConfigStore())

const registeredTarget = useAbuseReportTarget()

const isModalVisible = ref(false)

const target = computed(() => props.target ?? registeredTarget.value)

const isEnabled = computed(() => !!target.value && appInfo.value.allowReportingAbuse !== false)

const showIconOnly = computed(() => props.iconOnlyMobile && isMobileMode.value)
</script>

<template>
  <template v-if="isEnabled && target">
    <NcTooltip :disabled="!showIconOnly" placement="bottom">
      <template #title>{{ $t('labels.reportAbuse') }}</template>
      <a
        v-e="['c:share:abuse-report:open', { type: target.resourceType }]"
        v-bind="$attrs"
        href="#"
        class="nc-report-abuse-link !no-underline hover:!underline whitespace-nowrap inline-flex items-center"
        :aria-label="$t('labels.reportAbuse')"
        data-testid="nc-report-abuse-link"
        @click.prevent="isModalVisible = true"
      >
        <GeneralIcon v-if="showIconOnly" icon="ncFlag" class="h-4 w-4" />
        <template v-else>{{ $t('labels.reportAbuse') }}</template>
      </a>
    </NcTooltip>
    <GeneralReportAbuseModal v-model:visible="isModalVisible" :target="target" />
  </template>
</template>
