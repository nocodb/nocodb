<script setup lang="ts">
/** Details.vue's Tools shell with local active-tool state (the real rail routes out of the playground). */
const props = defineProps<{
  tools: string[]
}>()

const active = defineModel<string>('active', { required: true })

const { t } = useI18n()

const { base } = storeToRefs(useBase())

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { hasSaveBar } = useProvideShell()

const { toolGroups } = useTableToolsNav()

const webhooksRef = ref<{ createWebhook: () => void }>()

const recordTemplatesRef = ref<{ openTemplateForm: () => void }>()

const railGroups = computed(() =>
  toolGroups.value
    .map((g) => ({ ...g, items: g.items.filter((i) => props.tools.includes(i.slug)) }))
    .filter((g) => g.items.length),
)

const toolHeader = computed(() => {
  switch (active.value) {
    case 'templates':
      return { title: t('objects.recordTemplates'), description: t('labels.recordTemplatesSubtext') }
    case 'relation':
      return { title: t('title.relations'), description: t('labels.relationsSubtext') }
    case 'api':
      return { title: t('labels.apiSnippet'), description: t('labels.apiSnippetSubtext') }
    case 'webhook':
      return {
        title: t('objects.webhooks'),
        description: t('labels.webhooksSubtext'),
        docsHref: 'https://nocodb.com/docs/product-docs/automation/webhook',
      }
    default:
      return { title: t('general.manageFields'), description: t('labels.manageFieldsSubtext') }
  }
})
</script>

<template>
  <div class="relative flex h-full w-full" data-testid="nc-details-wrapper">
    <ShellRail :groups="railGroups" :active="active" @select="active = $event">
      <template v-if="meta" #subject>
        <GeneralTableIcon :meta="meta" class="!h-5 !w-5 !mx-0 flex-none text-nc-content-gray-subtle2" />
        <NcTooltip show-on-truncate-only class="truncate">{{ meta.title }}</NcTooltip>
      </template>
    </ShellRail>

    <div class="flex-1 flex flex-col min-w-0 min-h-0">
      <ShellHeader :title="toolHeader.title" :description="toolHeader.description" :docs-href="toolHeader.docsHref">
        <template #actions>
          <NcButton
            v-if="active === 'templates' && isEeUI"
            size="small"
            type="primary"
            @click="recordTemplatesRef?.openTemplateForm()"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="plus" class="h-4 w-4" />
              {{ $t('activity.createTemplate') }}
            </div>
          </NcButton>
          <NcButton v-else-if="active === 'webhook'" size="small" type="primary" @click="webhooksRef?.createWebhook()">
            <div class="flex items-center gap-1.5">
              <GeneralIcon icon="plus" class="h-4 w-4" />
              {{ $t('activity.newWebhook') }}
            </div>
          </NcButton>
        </template>
      </ShellHeader>

      <div class="flex-1 min-h-0 nc-shell-gutter">
        <LazySmartsheetDetailsFields v-if="active === 'field'" />
        <div v-else-if="active === 'templates' && isEeUI" class="h-full py-5">
          <SmartsheetDetailsRecordTemplates ref="recordTemplatesRef" in-shell />
        </div>
        <LazySmartsheetDetailsErd v-else-if="active === 'relation'" in-modal />
        <LazySmartsheetDetailsApi v-else-if="active === 'api' && base && meta && view" in-modal />
        <LazySmartsheetDetailsWebhooks v-else-if="active === 'webhook'" ref="webhooksRef" in-modal in-shell />
      </div>

      <ShellSaveBar v-if="hasSaveBar" />
    </div>
  </div>
</template>
