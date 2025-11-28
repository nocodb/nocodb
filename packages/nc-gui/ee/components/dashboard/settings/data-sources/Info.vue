<script lang="ts" setup>
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
      class="text-nc-content-gray !text-sm font-weight-normal flex items-center gap-2 mb-3 cursor-pointer"
      @click="copyIp"
    >
      <GeneralIcon icon="duplicate" class="text-nc-content-gray" />
      Whitelist our ip: 52.15.226.51 to allow database access
    </div>
    <div v-else class="w-full flex flex-col gap-3">
      <div class="text-sm text-nc-content-gray font-semibold">Whitelist IPs</div>
      <div class="text-small leading-[18px] text-nc-content-inverted-secondary">
        Ensure your database has allow-listed the following IPs:
      </div>

      <div class="flex items-center gap-4 cursor-pointer text-nc-content-gray text-sm font-bold" @click="copyIp">
        52.15.226.51
        <NcButton size="xs" type="text" class="!px-1">
          <GeneralIcon
            :icon="isCopied ? 'circleCheck2' : 'copy'"
            class="h-4 w-4"
            :class="{
              'text-nc-content-inverted-secondary': !isCopied,
              'text-nc-content-green-medium': isCopied,
            }"
          />
        </NcButton>
      </div>
    </div>
  </div>
</template>
