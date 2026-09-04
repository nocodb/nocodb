<script lang="ts" setup>
interface Props {
  /** Two-way bound draft for the first-time password entry. */
  modelValue: string
  /** Telemetry / test-id scope, e.g. 'view' | 'dashboard'. */
  scope: string
  /** Plaintext value for the legacy (pre-bcrypt) state. */
  legacyPassword?: string | null
  isLegacy?: boolean
  hasStored?: boolean
  disabled?: boolean
  saving?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  legacyPassword: null,
  isLegacy: false,
  hasStored: false,
  disabled: false,
  saving: false,
})

const emits = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'save', value: string): void
  (e: 'changePassword'): void
}>()

const draft = computed({
  get: () => props.modelValue,
  set: (value: string) => emits('update:modelValue', value),
})
</script>

<template>
  <!-- Legacy plaintext password (pre-bcrypt migration) — show as-is so owner can read it -->
  <div
    v-if="isLegacy"
    class="nc-share-password-row flex items-stretch h-9 bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg overflow-hidden shadow-default hover:border-nc-border-gray-dark transition-colors"
    @click.stop
  >
    <a-input-password
      :value="legacyPassword"
      class="nc-share-password-input flex-1 min-w-0 !bg-transparent"
      :data-testid="`nc-share-${scope}-password-legacy`"
      size="small"
      readonly
      :bordered="false"
      autocomplete="off"
      :name="`nc-share-${scope}-password-legacy`"
    />
    <button
      v-e="[`c:share:${scope}:password:change-open`]"
      type="button"
      :disabled="disabled"
      :data-testid="`nc-share-${scope}-password-change-btn`"
      class="nc-share-password-action flex items-center gap-1.5 px-3 text-bodySm font-weight-600 border-l-1 border-nc-border-gray-light bg-nc-bg-gray-extralight text-nc-content-gray-extreme hover:bg-nc-bg-gray-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      @click="emits('changePassword')"
    >
      <GeneralIcon icon="ncEdit" class="flex-none !w-3.5 !h-3.5" />
      <span>{{ $t('labels.changePassword') }}</span>
    </button>
  </div>

  <!-- Stored password (bcrypt-hashed): masked locked state + change action -->
  <div
    v-else-if="hasStored"
    class="nc-share-password-row flex items-stretch h-9 bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg overflow-hidden shadow-default hover:border-nc-border-gray-dark transition-colors"
    :data-testid="`nc-share-${scope}-password-locked`"
    @click.stop
  >
    <div class="flex-1 min-w-0 flex items-center gap-2 px-3">
      <GeneralIcon icon="ncLock" class="text-nc-content-gray-subtle !w-3.5 !h-3.5 flex-none" />
      <span class="text-nc-content-gray-subtle text-bodySm tracking-widest truncate">••••••••</span>
    </div>
    <button
      v-e="[`c:share:${scope}:password:change-open`]"
      type="button"
      :disabled="disabled"
      :data-testid="`nc-share-${scope}-password-change-btn`"
      class="nc-share-password-action flex items-center gap-1.5 px-3 text-bodySm font-weight-600 border-l-1 border-nc-border-gray-light bg-nc-bg-gray-extralight text-nc-content-gray-extreme hover:bg-nc-bg-gray-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      @click="emits('changePassword')"
    >
      <GeneralIcon icon="ncEdit" class="flex-none !w-3.5 !h-3.5" />
      <span>{{ $t('labels.changePassword') }}</span>
    </button>
  </div>

  <!-- First-time entry: inline input + explicit Save button -->
  <div v-else class="flex flex-col gap-1.5" @click.stop>
    <div
      class="nc-share-password-row flex items-stretch h-9 bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg overflow-hidden shadow-default hover:border-nc-border-gray-dark focus-within:(border-nc-border-brand shadow-selected) transition-colors"
    >
      <a-input-password
        v-model:value="draft"
        :placeholder="$t('placeholder.password.enter')"
        class="nc-share-password-input flex-1 min-w-0 !bg-transparent"
        :data-testid="`nc-modal-share-${scope}__password`"
        size="small"
        type="password"
        :bordered="false"
        autocomplete="new-password"
        :name="`nc-share-${scope}-password-new`"
        :readonly="disabled"
        :aria-describedby="`nc-share-${scope}-password-help`"
        @press-enter="emits('save', draft)"
      />
      <button
        v-e="[`c:share:${scope}:password:save-new`]"
        type="button"
        :disabled="!draft.trim() || disabled || saving"
        :data-testid="`nc-share-${scope}-password-save-btn`"
        class="nc-share-password-action flex items-center justify-center gap-1.5 px-4 text-bodySm font-weight-600 border-l-1 border-nc-border-gray-light transition-colors disabled:(opacity-60 cursor-not-allowed)"
        :class="
          draft.trim()
            ? 'bg-brand-500 text-white border-brand-500 md:(hover:bg-brand-600)'
            : 'bg-nc-bg-gray-extralight text-nc-content-gray-extreme hover:bg-nc-bg-gray-light'
        "
        @click="emits('save', draft)"
      >
        <GeneralLoader v-if="saving" size="small" class="!bg-inherit !text-inherit" />
        <span>{{ $t('general.save') }}</span>
      </button>
    </div>
    <span :id="`nc-share-${scope}-password-help`" class="text-bodySm text-nc-content-gray-subtle leading-snug">
      {{ $t('msg.info.viewPasswordNotVisibleAfterSave') }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.nc-share-password-row {
  :deep(.ant-input-affix-wrapper),
  :deep(.ant-input-password),
  :deep(.ant-input),
  :deep(input) {
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
    outline: 0 !important;
    border-radius: 0 !important;
    -webkit-appearance: none !important;
    appearance: none !important;

    &:hover,
    &:focus,
    &:active,
    &:focus-within,
    &.ant-input-affix-wrapper-focused {
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      outline: 0 !important;
    }
  }

  :deep(.ant-input-affix-wrapper),
  :deep(.ant-input-password) {
    height: 100% !important;
    padding: 0 12px !important;
    flex: 1 1 0;
    min-width: 0;
  }

  :deep(.ant-input) {
    padding: 0 !important;
  }

  :deep(.ant-input-suffix) {
    margin-left: 8px;
  }
}
</style>
