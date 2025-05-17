<script lang="ts" setup>
interface Props {
  isLoading?: boolean
}

const props = defineProps<Props>()

const { isLoading } = toRefs(props)

const { baseHomeSearchQuery } = storeToRefs(useBases())

const { commandPalette } = useCommandPalette()

const { isMobileMode } = useGlobal()

const handleClick = () => {
  if (isLoading.value) return

  commandPalette.value?.open()
}
</script>

<template>
  <div v-if="!isMobileMode" class="px-2 h-11 flex items-center">
    <div class="w-full" @click="handleClick">
      <a-input
        v-model:value="baseHomeSearchQuery"
        type="text"
        class="nc-input-border-on-value nc-input-shadow !h-8 !pl-2.5 !pr-2 !py-1 !rounded-lg"
        placeholder="Quick search..."
        allow-clear
        readonly
        @keydown.stop
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-1 h-4 w-4 text-gray-500 group-hover:text-black" />
        </template>
        <template #suffix>
          <div class="px-1 text-bodySmBold text-nc-content-gray-subtle bg-nc-bg-gray-medium rounded">
            {{ renderCmdOrCtrlKey(true) }} K
          </div>
        </template>
      </a-input>
    </div>
  </div>
</template>
