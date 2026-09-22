<script lang="ts" setup>
// Title block — identical on every pane of every shell (the shell contract):
//   Title                              [secondary] [primary] | [×]
//   Description · Docs ↗
// The pane title appears here exactly once; panes must not echo it in the body.
interface Props {
  title: string
  description?: string
  docsHref?: string
  closeTestid?: string
}

withDefaults(defineProps<Props>(), {
  closeTestid: 'nc-tools-shell-close',
})

const emits = defineEmits<{
  close: []
}>()
</script>

<template>
  <div class="flex-none flex items-start gap-4 px-6 pt-5 pb-3" data-testid="nc-tool-header">
    <div class="flex-1 min-w-0">
      <div class="text-xl font-semibold leading-7 text-nc-content-gray-extreme truncate">{{ title }}</div>
      <div v-if="description || docsHref" class="mt-0.5 text-sm leading-5 text-nc-content-gray-muted">
        <span v-if="description">{{ description }}</span>
        <a
          v-if="docsHref"
          :href="docsHref"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 ml-1.5 font-medium text-nc-content-brand !no-underline hover:underline"
        >
          {{ $t('title.docs') }}
          <GeneralIcon icon="ncExternalLink" class="!h-3.5 !w-3.5" />
        </a>
      </div>
    </div>

    <div class="flex items-center gap-2.5 flex-none">
      <slot name="actions" />

      <!-- Where panes land their own action rows, via `ShellActions`. -->
      <div id="nc-shell-actions" class="flex items-center gap-2.5 empty:hidden" />

      <div class="h-5 w-px bg-nc-border-gray-medium" />

      <NcButton size="small" type="text" :data-testid="closeTestid" @click="emits('close')">
        <GeneralIcon icon="close" class="!h-4 !w-4" />
      </NcButton>
    </div>
  </div>
</template>
