<script lang="ts" setup>
interface Props {
  tooltip: string
}

const props = withDefaults(defineProps<Props>(), {})

const {} = toRefs(props)
</script>

<template>
  <NcTooltip
    :attrs="{
      class: 'w-full',
    }"
    placement="top"
  >
    <template #title>
      <slot v-if="$slots.tooltip" name="tooltip"></slot>
      <template v-else>
        {{ tooltip }}
      </template>
    </template>

    <div
      class="nc-copy-field flex flex-row justify-between items-center w-[calc(100%_-_8px)] pl-2 pr-1 py-1 mx-1 rounded-md hover:bg-gray-100 cursor-pointer group"
      data-testid="nc-field-item-action-copy-id"
      @click.stop="onClickCopyFieldUrl(column)"
    >
      <div class="w-full flex flex-row justify-between items-center gap-x-2 font-bold text-xs">
        <div class="flex flex-row text-gray-600 text-xs items-baseline gap-x-1 font-bold whitespace-nowrap">
          {{
            $t('labels.idColon', {
              id: column.id,
            })
          }}
        </div>
        <NcButton size="xsmall" type="secondary" class="!group-hover:bg-gray-100">
          <div class="flex children:flex-none relative h-4 w-4">
            <Transition name="icon-fade">
              <GeneralIcon v-if="isFieldIdCopied" icon="check" class="h-4 w-4 opacity-80" />
              <GeneralIcon v-else icon="copy" class="h-4 w-4 opacity-80" />
            </Transition>
          </div>
        </NcButton>
      </div>
    </div>
  </NcTooltip>
</template>

<style lang="scss" scoped></style>
