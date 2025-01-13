<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  password?: boolean
}>()

const { copy } = useCopy()

const { t } = useI18n()

const copied = ref(false)

const copyValue = async () => {
  await copy(props.modelValue)
  message.info(t('msg.info.copiedToClipboard'))
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div class="relative inline-flex items-center w-full h-full" @click="copyValue">
    <a-input :value="modelValue" readonly :type="password ? 'password' : 'input'" class="pr-10 !bg-neutral-100" />
    <div class="absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer">
      <GeneralIcon v-if="copied" class="max-h-4 min-w-4" icon="check" />
      <GeneralIcon v-else class="max-h-4 min-w-4" icon="copy" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
