<script lang="ts" setup>
// Title block — identical on every pane of every shell (the shell contract):
//   Title                                    [secondary] [primary]
//   Description · Docs ↗
// The pane title appears here exactly once; panes must not echo it in the body.
interface Props {
  title: string
  description?: string
  docsHref?: string
  /** Clears the corner back button (`ShellBack`), the way `pr-14` clears the close one. */
  leadingInset?: boolean
  /** A shell hosted as a page has no corner close button to clear. */
  noCloseInset?: boolean
}

defineProps<Props>()

const shell = useShell()

/** A blank crumb is no crumb: never render a muted title trailed by a lone chevron. */
const crumb = computed(() => {
  const label = shell?.crumb?.value?.trim()

  return label || null
})
</script>

<!--
  `pr-14` keeps the action row clear of the corner close button; from xl the
  gutter is already wider than the button needs, so it goes back to matching the
  pane content below.
-->
<template>
  <div
    class="flex-none flex flex-wrap items-start gap-x-4 gap-y-3 nc-shell-gutter pt-4 sm:pt-8 pb-3"
    :class="{ '!pl-14': leadingInset, 'pr-14 xl:pr-20': !noCloseInset }"
    data-testid="nc-tool-header"
  >
    <!-- `min-w-60` is what makes the row wrap: rather than squeeze the title and
         description into a column too narrow to read, the actions drop to a line
         of their own once they no longer both fit. -->
    <div class="flex-1 min-w-60">
      <!-- Drilled in, the pane title becomes the parent crumb. -->
      <div class="flex items-baseline gap-1.5 min-w-0 text-lg sm:text-xl font-semibold leading-7">
        <template v-if="crumb">
          <button
            type="button"
            class="nc-shell-crumb-parent flex-none bg-transparent border-0 p-0 font-inherit text-nc-content-gray-muted hover:text-nc-content-gray cursor-pointer truncate"
            data-testid="nc-shell-crumb-parent"
            @click="shell?.goBack()"
          >
            {{ title }}
          </button>
          <GeneralIcon icon="chevronRight" class="flex-none !h-4 !w-4 text-nc-content-gray-muted" />
          <span class="text-nc-content-gray-extreme truncate">{{ crumb }}</span>
        </template>
        <span v-else class="text-nc-content-gray-extreme truncate">{{ title }}</span>
      </div>
      <div v-if="!crumb && (description || docsHref)" class="mt-0.5 text-sm leading-5 text-nc-content-gray-muted">
        <span v-if="description">{{ description }}</span>
        <a
          v-if="docsHref"
          :href="docsHref"
          target="_blank"
          rel="noopener noreferrer"
          class="nc-shell-docs inline-flex items-center gap-1 ml-1.5 !no-underline hover:underline"
        >
          {{ $t('title.docs') }}
          <GeneralIcon icon="ncExternalLink" class="!h-3.5 !w-3.5" />
        </a>
      </div>
    </div>

    <!-- One zone for both the host's own actions and whatever a pane teleports in
         (via `ShellActions`), so it collapses when it holds neither. Close is not
         here — it lives in the modal's corner (`ShellClose`). -->
    <!-- `-mt-0.5` centres 32px controls on the 28px title line. -->
    <div
      :id="shell?.actionsTargetId"
      class="nc-shell-header-actions -mt-0.5 ml-auto flex items-center gap-2.5 flex-none empty:hidden"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Inherits the description colour: a footnote, not a call to action.
.nc-shell-docs,
.nc-shell-docs:hover,
.nc-shell-docs:focus {
  color: inherit;
}
</style>
