<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

const props = defineProps<{
  modelValue: boolean
}>()

const emits = defineEmits(['update:modelValue', 'submit'])

const dialogShow = useVModel(props, 'modelValue', emits)

const focusInput: VNodeRef = (el) => el && el?.focus?.()

const creating = ref(false)

const table = ref({})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.createTable')"
    size="small"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex flex-col gap-2 w-full">
        <div class="text-base font-bold text-nc-content-gray-emphasis">
          {{ $t('title.lockeThisView') }}
        </div>
        <div class="text-sm text-nc-content-gray">
          {{ $t('title.lockeThisViewSubtle') }}
        </div>
      </div>
    </template>

    <a-form
      layout="vertical"
      :model="table"
      name="create-new-table-form"
      class="flex flex-col gap-5 !mt-1"
      @keydown.enter="emits('submit')"
      @keydown.esc="dialogShow = false"
    >
      <div class="flex flex-col gap-5">
        <a-form-item>
          <a-textarea
            :ref="focusInput"
            v-model:value="table.title"
            class="!rounded-lg !text-sm nc-input-shadow !min-h-[120px] max-h-[500px] nc-scrollbar-thin"
            size="large"
            hide-details
            data-testid="create-table-title-input"
            :placeholder="$t('placeholder.lockViewDescription')"
          />
        </a-form-item>
      </div>

      <div class="flex gap-2 items-center justify-end">
        <NcButton type="secondary" size="small" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>

        <NcButton type="primary" size="small" :loading="creating" @click="emits('submit')">
          <template #icon>
            <GeneralIcon icon="ncLock" class="flex-none" />
          </template>
          {{ $t('labels.lockView') }}
        </NcButton>
      </div>
    </a-form>
  </NcModal>
</template>

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}
</style>
