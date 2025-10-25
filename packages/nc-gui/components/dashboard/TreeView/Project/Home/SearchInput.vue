<script lang="ts" setup>
interface Props {
  isLoading?: boolean
}

const props = defineProps<Props>()

const { isLoading } = toRefs(props)

const { baseHomeSearchQuery } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const { isShowEveryonePersonalViewsEnabled } = storeToRefs(useViewsStore())

const { commandPalette } = useCommandPalette()

const { isMobileMode } = useGlobal()

const isOpenOptionsDropdown = ref(false)

const handleClick = () => {
  if (isLoading.value) return

  commandPalette.value?.open()
}
</script>

<template>
  <div v-if="!isMobileMode && !isSharedBase" class="px-2 h-11 flex items-center">
    <div class="w-full" @click="handleClick">
      <a-input
        v-model:value="baseHomeSearchQuery"
        type="text"
        class="nc-input-border-on-value nc-input-shadow !h-8 !pl-2.5 !pr-1 !py-1 !rounded-lg"
        placeholder="Quick search..."
        allow-clear
        readonly
        @keydown.stop
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-1 h-4 w-4 text-nc-content-gray-muted group-hover:text-nc-content-gray-extreme" />
        </template>
        <template #suffix>
          <div class="flex items-center gap-1">
            <div class="px-1 text-bodySmBold text-nc-content-gray-subtle bg-nc-bg-gray-medium rounded">
              {{ renderCmdOrCtrlKey(true) }} K
            </div>
            <NcDropdown v-if="isEeUI" v-model:visible="isOpenOptionsDropdown">
              <NcButton icon-only size="xxsmall" type="text" @click.stop>
                <template #icon> <GeneralIcon icon="ncSettings" /> </template>
              </NcButton>
              <template #overlay>
                <div class="p-4 flex flex-col gap-3">
                  <div class="!capitalize text-captionBold font-semibold text-nc-content-gray-subtle2">
                    {{ $t('general.options') }}
                  </div>
                  <div
                    class="flex items-center text-bodyDefaultSm text-nc-content-gray-muted hover:text-nc-content-gray-subtle2 xs:(text-base px-3.5 mx-0) select-none"
                  >
                    <NcSwitch v-model:checked="isShowEveryonePersonalViewsEnabled" size="xsmall">
                      {{ $t('labels.showEveryonesPersonalViews') }}
                    </NcSwitch>
                  </div>
                </div>
              </template>
            </NcDropdown>
          </div>
        </template>
      </a-input>
    </div>
  </div>
</template>
