<script lang="ts" setup>
import { message } from 'ant-design-vue'

const { copy } = useCopy()

const copyIp = async () => {
  await copy('52.15.226.51')
  message.success('Copied to clipboard')
}
</script>

<template>
  <div class="text-gray-800 !text-sm font-weight-normal flex items-center gap-2 mb-3 cursor-pointer" @click="copyIp">
    <GeneralIcon icon="duplicate" class="text-gray-800" />
    Whitelist our ip: 52.15.226.51 to allow database access
  </div>
</template>
