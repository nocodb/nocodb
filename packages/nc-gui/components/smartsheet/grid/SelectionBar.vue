<script setup lang="ts">
interface Props {
  count: number
}

defineProps<Props>()

const emits = defineEmits<{
  clear: []
}>()

const { setActiveCmdView } = useCommand()
</script>

<template>
  <Transition name="nc-selection-bar">
    <div
      v-if="count"
      class="nc-grid-selection-bar absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex items-center h-9 gap-1 pl-3 pr-1 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default shadow-lg"
      data-testid="nc-grid-selection-bar"
    >
      <span class="text-bodyDefaultSm text-nc-content-gray whitespace-nowrap leading-none">
        {{ $t('labels.countSelected', { count }) }}
      </span>

      <div class="h-4 w-px mx-1.5 bg-nc-border-gray-medium flex-none" />

      <NcButton
        v-e="['c:command-palette:selection-bar:open']"
        size="xs"
        type="text"
        class="!h-7"
        data-testid="nc-grid-selection-bar-actions"
        @click="setActiveCmdView('cmd-k')"
      >
        <div class="flex items-center gap-2 leading-none">
          <span class="text-bodyDefaultSm">{{ $t('general.actions') }}</span>
          <GeneralShortcutLabel :keys="[renderCmdOrCtrlKey(true), 'K']" class="nc-selection-bar-keys" />
        </div>
      </NcButton>

      <NcTooltip :title="$t('labels.clearSelection')" :arrow="false" class="flex">
        <NcButton size="xs" type="text" class="!h-7 !w-7 !px-0" data-testid="nc-grid-selection-bar-clear" @click="emits('clear')">
          <GeneralIcon icon="ncX" class="h-4 w-4 text-nc-content-gray-subtle" />
        </NcButton>
      </NcTooltip>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
// ShortcutLabel's keys are 24px line-height in a 20px box; centre them on the label's line.
.nc-selection-bar-keys {
  @apply items-center text-nc-content-gray-muted;

  :deep(.nc-shortcut-label) {
    @apply flex items-center justify-center h-[18px] min-h-0 leading-none;
  }
}

.nc-selection-bar-enter-active,
.nc-selection-bar-leave-active {
  @apply transition-all duration-150 ease-out;
}

.nc-selection-bar-enter-from,
.nc-selection-bar-leave-to {
  @apply opacity-0 translate-y-2;
}
</style>
