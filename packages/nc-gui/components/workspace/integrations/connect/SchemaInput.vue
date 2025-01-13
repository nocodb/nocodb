<script lang="ts" setup>
const { basesList } = storeToRefs(useBases())

const isOpen = ref<boolean>(false)

const activeSchemaId = ref<string | undefined>()

const { copy } = useCopy()

const { t } = useI18n()

const copied = ref(false)

const copyValue = async () => {
  await copy(activeSchemaId.value ?? '')
  message.info(t('msg.info.copiedToClipboard'))
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

onMounted(() => {
  if (basesList.value?.length) {
    activeSchemaId.value = basesList.value[0]?.id
  }
})
</script>

<template>
  <div
    class="relative group w-full border-1 border-nc-border-gray-medium rounded-lg bg-nc-bg-gray-extralight h-8 flex items-center text-nc-content-gray-muted"
  >
    <NcDropdown v-model:visible="isOpen" overlay-class-name="overflow-hidden max-w-[320px]">
      <div @click.stop class="h-full flex-1 px-3 mr-8 flex items-center gap-2 cursor-pointer">
        <div>
          {{ activeSchemaId }}
        </div>
        <GeneralIcon
          icon="chevronDown"
          class="!text-current opacity-70 flex-none transform transition-transform duration-250 w-3.5 h-3.5"
          :class="{ '!rotate-180': isOpen }"
        />
      </div>

      <template #overlay>
        <NcList
          v-model:value="activeSchemaId"
          v-model:open="isOpen"
          @update:value="copyValue"
          :list="basesList"
          search-input-placeholder="Search"
          option-label-key="title"
          option-value-key="id"
          :close-on-select="true"
          :item-height="56"
          class="!w-full"
          container-class-name="!max-h-[171px]"
        >
          <template #listItemContent="{ option }">
            <div class="flex-1 flex flex-col truncate">
              <div class="flex items-center gap-2">
                <GeneralBaseIconColorPicker
                  :type="option?.type"
                  :model-value="parseProp(option.meta).iconColor"
                  size="xsmall"
                  readonly
                >
                </GeneralBaseIconColorPicker>
                <div class="truncate text-nc-content-gray">
                  {{ option.id }}
                </div>
              </div>
              <div class="w-full pl-7 text-nc-content-gray-muted text-small leading-[18px] truncate">
                <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                  <template #title>
                    {{ option?.title }}
                  </template>
                  {{ option?.title }}
                </NcTooltip>
              </div>
            </div>
          </template>
        </NcList>
      </template>
    </NcDropdown>

    <div
      @click="copyValue"
      class="absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer transition-colors text-nc-content-gray-muted group-hover:text-nc-content-gray-subtle"
    >
      <GeneralIcon v-if="copied" class="max-h-4 min-w-4 !text-current" icon="check" />
      <GeneralIcon v-else class="max-h-4 min-w-4 !text-current" icon="copy" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
