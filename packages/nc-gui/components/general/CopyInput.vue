<script setup lang="ts">
const props = defineProps<{
  modelValue?: string
  password?: boolean
  disableCopy?: boolean
}>()

const { copy } = useCopy()

const { t } = useI18n()

const copied = ref(false)

const copyValue = async () => {
  if (!props.modelValue) return

  await copy(props.modelValue)
  message.info(t('msg.info.copiedToClipboard'))
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div class="relative inline-flex items-center w-full h-full group" @click="copyValue">
    <a-input :value="modelValue" disabled :type="password ? 'password' : 'input'" class="!pr-8 !truncate !bg-white" />
    <div
      class="absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer transition-colors text-nc-content-gray-muted group-hover:text-nc-content-gray-subtle"
    >
      <template v-if="!disableCopy">
        <GeneralIcon v-if="copied" class="max-h-4 min-w-4 !text-current" icon="check" />
        <GeneralIcon v-else class="max-h-4 min-w-4 !text-current" icon="copy" />
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
