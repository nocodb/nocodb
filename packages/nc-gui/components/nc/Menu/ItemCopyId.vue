<script lang="ts" setup>
interface Props {
  id?: string
  tooltip?: string
  label?: string
}

const props = withDefaults(defineProps<Props>(), {})

const { id } = toRefs(props)

const { copy } = useCopy()

const isCopied = ref<boolean>(false)

const onClickCopy = async () => {
  if (!id.value) return

  try {
    await copy(id.value)

    isCopied.value = true

    await ncDelay(3000)

    isCopied.value = false
  } catch (e: any) {
    message.error(e.message)
  }
}
</script>

<template>
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
      v-bind="$attrs"
      class="nc-copy-field flex flex-row justify-between items-center w-[calc(100%_-_8px)] pl-2 pr-1 py-1 mx-1 rounded-md hover:bg-gray-100 cursor-pointer group transition-colors duration-300"
      @click.stop="onClickCopy"
    >
      <div class="w-full flex flex-row justify-between items-center gap-x-2 font-bold text-xs">
        <div class="flex flex-row text-gray-600 text-xs items-baseline gap-x-1 font-bold whitespace-nowrap">
          <slot v-if="$slots.label" name="label"></slot>
          <template v-else-if="label">
            {{ label }}
          </template>
          <template v-else>
            {{ id }}
          </template>
        </div>
        <NcButton size="xsmall" type="secondary" class="!group-hover:bg-gray-100">
          <div class="flex children:flex-none relative h-4 w-4">
            <Transition name="icon-fade">
              <GeneralIcon v-if="isCopied" icon="check" class="h-4 w-4 opacity-80" />
              <GeneralIcon v-else icon="copy" class="h-4 w-4 opacity-80" />
            </Transition>
          </div>
        </NcButton>
      </div>
    </div>
  </NcTooltip>
</template>

<style lang="scss" scoped></style>
