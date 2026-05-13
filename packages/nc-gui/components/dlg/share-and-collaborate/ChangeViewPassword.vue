<script setup lang="ts">
interface Props {
  visible: boolean
  /** Modal title — defaults to "Change View Password". */
  title?: string
  /** Telemetry event key fired on save. */
  telemetryKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  telemetryKey: 'c:share:view:password:change-save',
})

const emits = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'save', value: string): void
}>()

const visible = useVModel(props, 'visible', emits, { defaultValue: false })

const passwordInput = ref('')

const isSubmitting = ref(false)

const isValid = computed(() => passwordInput.value.trim().length > 0)

const onCancel = () => {
  visible.value = false
}

const onSave = async () => {
  if (!isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  try {
    emits('save', passwordInput.value.trim())
  } finally {
    // Parent owns the close + reset cycle; reset locally too in case the
    // parent keeps the modal mounted on rapid re-opens.
    isSubmitting.value = false
  }
}

watch(visible, (open) => {
  if (open) {
    passwordInput.value = ''
  }
})
</script>

<template>
  <NcModal
    v-model:visible="visible"
    :show-separator="false"
    size="small"
    wrap-class-name="nc-change-view-password-modal-wrapper"
    @keydown.esc="onCancel"
  >
    <template #header>
      <div class="flex flex-col gap-2 w-full">
        <div class="text-base font-bold text-nc-content-gray-emphasis">
          {{ props.title || $t('labels.changeViewPassword') }}
        </div>
        <div class="text-bodySm font-normal text-nc-content-gray-subtle">
          {{ $t('msg.info.viewPasswordNotVisibleAfterSave') }}
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-4 mt-2">
      <a-input-password
        v-model:value="passwordInput"
        :placeholder="$t('placeholder.password.enter')"
        class="!rounded-lg !py-1.5"
        data-testid="nc-change-view-password-input"
        size="small"
        autofocus
        autocomplete="new-password"
        name="nc-change-view-password-new"
        @press-enter="onSave"
      />

      <div class="flex flex-row justify-end gap-2 pt-2 border-t-1 border-nc-border-gray-medium mt-2">
        <NcButton data-testid="nc-change-view-password-cancel-btn" size="small" type="secondary" @click="onCancel">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton
          v-e="[props.telemetryKey]"
          :disabled="!isValid"
          :loading="isSubmitting"
          data-testid="nc-change-view-password-save-btn"
          size="small"
          type="primary"
          @click="onSave"
        >
          {{ $t('general.save') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
