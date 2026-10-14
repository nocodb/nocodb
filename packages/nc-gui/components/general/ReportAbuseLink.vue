<script setup lang="ts">
interface Props {
  /** Defaults to the page's registered target (`useAbuseReportTarget`). */
  target?: AbuseReportTarget
}

const props = defineProps<Props>()

const { appInfo } = useGlobal()

const registeredTarget = useAbuseReportTarget()

const isModalVisible = ref(false)

const target = computed(() => props.target ?? registeredTarget.value)

const isEnabled = computed(() => !!target.value && appInfo.value.allowReportingAbuse !== false)
</script>

<template>
  <template v-if="isEnabled && target">
    <a
      v-e="['c:share:abuse-report:open', { type: target.resourceType }]"
      href="#"
      class="nc-report-abuse-link !text-current !no-underline hover:!underline whitespace-nowrap"
      data-testid="nc-report-abuse-link"
      @click.prevent="isModalVisible = true"
    >
      {{ $t('labels.reportAbuse') }}
    </a>
    <GeneralReportAbuseModal v-model:visible="isModalVisible" :target="target" />
  </template>
</template>
