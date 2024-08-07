<script lang="ts" setup>
import { message } from 'ant-design-vue'

const props = withDefaults(defineProps<{ varient: 'old' | 'new' }>(), {
  varient: 'old',
})

const { varient } = props

const { copy } = useCopy()

const isCopied = ref(false)

const copyIp = async () => {
  await copy('52.15.226.51')
  message.success('Copied to clipboard')

  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 5000)
}
</script>

<template>
  <div>
    <div
      v-if="varient === 'old'"
      class="text-gray-800 !text-sm font-weight-normal flex items-center gap-2 mb-3 cursor-pointer"
      @click="copyIp"
    >
      <GeneralIcon icon="duplicate" class="text-gray-800" />
      Whitelist our ip: 52.15.226.51 to allow database access
    </div>
    <div v-else class="w-full flex flex-col gap-3">
      <div class="text-sm text-gray-800 font-semibold">Whitelist IPs</div>
      <div class="text-small leading-[18px] text-gray-700">Ensure your database has allow-listed the following IPs:</div>

      <div class="flex items-center gap-4 cursor-pointer text-gray-800 text-sm font-bold" @click="copyIp">
        52.15.226.51
        <NcButton size="xs" type="text" class="!px-1">
          <GeneralIcon
            :icon="isCopied ? 'circleCheck2' : 'copy'"
            class="h-4 w-4"
            :class="{
              'text-gray-700': !isCopied,
              'text-green-500': isCopied,
            }"
          />
        </NcButton>
      </div>
    </div>
  </div>
</template>
