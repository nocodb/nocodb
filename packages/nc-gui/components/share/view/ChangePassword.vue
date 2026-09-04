<script lang="ts" setup>
const popover = useShareViewPopover()!

const { isUpdating, goBack, onPasswordChanged } = popover

const passwordInput = ref('')

const isValid = computed(() => passwordInput.value.trim().length > 0)

const onSave = async () => {
  if (!isValid.value || isUpdating.value.password) return
  await onPasswordChanged(passwordInput.value.trim())
}
</script>

<template>
  <div class="flex flex-col">
    <ShareCommonPopoverHeader :title="$t('labels.changeViewPassword')" show-back @back="goBack" />

    <NcDivider class="!my-0" />

    <div class="px-4 py-3 flex flex-col gap-3">
      <div class="text-bodySm text-nc-content-gray-subtle leading-snug">
        {{ $t('msg.info.viewPasswordNotVisibleAfterSave') }}
      </div>
      <a-input-password
        v-model:value="passwordInput"
        :placeholder="$t('placeholder.password.enter')"
        class="!rounded-md !py-1"
        data-testid="nc-change-view-password-input"
        size="small"
        autofocus
        autocomplete="new-password"
        name="nc-share-view-password-change"
        @press-enter="onSave"
      />
    </div>

    <NcDivider class="!my-0" />

    <div class="flex items-center justify-end gap-2 px-3 py-3">
      <NcButton type="secondary" size="small" data-testid="nc-change-view-password-cancel-btn" @click="goBack">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton
        v-e="['c:share:view:password:change-save']"
        :disabled="!isValid"
        :loading="isUpdating.password"
        type="primary"
        size="small"
        data-testid="nc-change-view-password-save-btn"
        @click="onSave"
      >
        {{ $t('general.save') }}
      </NcButton>
    </div>
  </div>
</template>
