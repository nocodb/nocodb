<script lang="ts" setup>
// Title block — identical on every pane of every shell (the shell contract):
//   Title                                    [secondary] [primary]
//   Description · Docs ↗
// The pane title appears here exactly once; panes must not echo it in the body.
interface Props {
  title: string
  description?: string
  docsHref?: string
}

defineProps<Props>()

const shell = useShell()
</script>

<!--
  `pr-14` keeps the action row clear of the corner close button; from xl the
  gutter is already wider than the button needs, so it goes back to matching the
  pane content below.
-->
<template>
  <div
    class="flex-none flex flex-wrap items-start gap-x-4 gap-y-3 nc-shell-gutter pt-8 pb-3 pr-14 xl:pr-20"
    data-testid="nc-tool-header"
  >
    <!-- `min-w-60` is what makes the row wrap: rather than squeeze the title and
         description into a column too narrow to read, the actions drop to a line
         of their own once they no longer both fit. -->
    <div class="flex-1 min-w-60">
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

    <!-- One zone for both the host's own actions and whatever a pane teleports in
         (via `ShellActions`), so it collapses when it holds neither. Close is not
         here — it lives in the modal's corner (`ShellClose`). -->
    <div :id="shell?.actionsTargetId" class="nc-shell-header-actions ml-auto flex items-center gap-2.5 flex-none empty:hidden">
      <slot name="actions" />
    </div>
  </div>
</template>
