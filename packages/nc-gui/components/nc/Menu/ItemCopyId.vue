<script lang="ts" setup>
interface Props {
  id?: string
  tooltip?: string
  label?: string
  /** Render as a section header label with entity name left, copyable ID right */
  inline?: boolean
  /** Entity name shown on the left when inline (e.g. "Table", "View") */
  entityLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  inline: false,
})

const { id } = toRefs(props)

const { copy } = useCopy()

const { t } = useI18n()

const isCopied = ref<boolean>(false)

let copiedTimeoutId: any

const onClickCopy = async () => {
  if (copiedTimeoutId) {
    clearTimeout(copiedTimeoutId)
  }

  if (!id.value) return

  try {
    await copy(id.value)

    isCopied.value = true

    copiedTimeoutId = setTimeout(() => {
      isCopied.value = false
      clearTimeout(copiedTimeoutId)
    }, 3000)
  } catch (e: any) {
    message.error(e.message)
  }
}
</script>

<template>
  <!-- Inline mode: section header with entity name + copyable ID -->
  <div v-if="inline" class="nc-ant-dropdown-menu-item-label">
    <div class="flex items-center justify-between w-full">
      <span>{{ entityLabel }}</span>
      <NcTooltip :title="isCopied ? $t('general.copied') : (tooltip || $t('labels.clickToCopy'))">
        <button
          class="nc-copy-id-btn flex items-center gap-1 text-[10px] text-nc-content-gray-subtle2 hover:text-nc-content-gray-muted cursor-pointer font-normal transition-colors"
          @click.stop="onClickCopy"
        >
          <span class="truncate max-w-24">{{ id }}</span>
          <GeneralIcon :icon="isCopied ? 'check' : 'copy'" class="h-3 w-3 flex-none" />
        </button>
      </NcTooltip>
    </div>
  </div>

  <!-- Classic mode: full-width copyable row -->
  <div v-else class="w-full">
    <NcTooltip
      :attrs="{
        class: 'w-full',
      }"
      placement="top"
      :disabled="!tooltip && !$slots.tooltip"
    >
      <template #title>
        <slot v-if="$slots.tooltip" name="tooltip"></slot>
        <template v-else>
          {{ tooltip }}
        </template>
      </template>

      <div
        class="flex flex-row justify-between items-center w-[calc(100%_-_8px)] pl-2 pr-1 py-1 mx-1 rounded-md hover:bg-nc-bg-gray-light cursor-pointer group transition-colors duration-300"
        @click.stop="onClickCopy"
      >
        <div class="w-full flex flex-row justify-between items-center gap-x-2 font-bold text-xs">
          <div class="flex flex-row text-nc-content-gray-subtle2 text-xs items-baseline gap-x-1 font-bold whitespace-nowrap">
            <slot v-if="$slots.label" name="label"></slot>
            <template v-else-if="label">
              {{ label }}
            </template>
            <template v-else>
              {{ id }}
            </template>
          </div>
          <NcButton size="xsmall" type="secondary" class="!group-hover:bg-nc-bg-gray-light">
            <div class="flex children:flex-none relative h-4 w-4">
              <Transition name="icon-fade" :duration="200">
                <GeneralIcon v-if="isCopied" icon="check" class="h-4 w-4 opacity-80" />
                <GeneralIcon v-else icon="copy" class="h-4 w-4 opacity-80" />
              </Transition>
            </div>
          </NcButton>
        </div>
      </div>
    </NcTooltip>
  </div>
</template>

<style lang="scss" scoped>
.nc-ant-dropdown-menu-item-label {
  @apply flex items-center min-h-7 py-3 px-2 mx-2 xs:(text-base px-3.5 mx-0) font-bold uppercase text-xs text-nc-content-gray-muted;
}
</style>
