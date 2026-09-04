<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'

const popover = useShareViewPopover()!

const {
  goBack,
  goTo,
  activeView,
  allowCSVDownload,
  passwordProtected,
  hasStoredPassword,
  isLegacyPlaintextPassword,
  newPasswordDraft,
  isUpdating,
  isReadOnly,
  isFormView,
  hasDownloadOption,
  languageSet,
  withLanguage,
  themeSet,
  defaultTheme,
  surveyMode,
  formPreFill,
  preFillFormSearchParams,
  togglePasswordProtected,
  saveNewPassword,
  openChangePasswordModal,
  toggleLanguageSet,
  toggleThemeSet,
  handleChangeFormPreFill,
  persistCustomUrl,
  disableLink,
} = popover

const onGenerateNewLink = () => {
  if (isReadOnly.value) return
  goTo('regenerate-confirm')
}

const { showEEFeatures } = useEeConfig()
const { appInfo } = useGlobal()
const { copy } = useCopy()

const languages = computed(() => Object.entries(Language).sort() as [keyof typeof Language, Language][])

const languageOptions = computed(() => {
  return languages.value.map(([key, lang]) => ({
    label: Language[key] || lang,
    value: key,
  }))
})

const themeOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
]

const copyCustomUrl = async (custUrl = '') => {
  return await copy(
    `${appInfo.value.ncSiteUrl}/p/${encodeURIComponent(custUrl)}${
      preFillFormSearchParams.value && activeView.value?.type === ViewTypes.FORM ? `?${preFillFormSearchParams.value}` : ''
    }`,
  )
}
</script>

<template>
  <div class="flex flex-col">
    <ShareCommonPopoverHeader :title="$t('activity.linkSettings')" show-back @back="goBack" />

    <NcDivider class="!my-0" />

    <div class="flex flex-col py-1">
      <ShareCommonToggleRow
        v-if="hasDownloadOption"
        v-model="allowCSVDownload"
        :label="$t('activity.allowDownload')"
        :loading="isUpdating.download"
        :disabled="isReadOnly"
        ve-key="c:share:view:allow-csv-download:toggle"
        testid="share-download-toggle"
      />

      <ShareCommonToggleRow
        :model-value="passwordProtected"
        :label="$t('activity.restrictAccessWithPassword')"
        :loading="isUpdating.password"
        :disabled="isReadOnly"
        ve-key="c:share:view:password:toggle"
        testid="share-password-toggle"
        @update:model-value="togglePasswordProtected"
      >
        <!-- Legacy plaintext password (pre-bcrypt migration) — show as-is so owner can read it -->
        <div v-if="isLegacyPlaintextPassword" class="flex items-center gap-2">
          <a-input-password
            :value="activeView?.password"
            class="!rounded-lg !py-1 !bg-nc-bg-default flex-1"
            data-testid="nc-share-view-password-legacy"
            size="small"
            readonly
            autocomplete="off"
            name="nc-share-view-password-legacy"
          />
          <NcButton
            v-e="['c:share:view:password:change-open']"
            :disabled="isReadOnly"
            data-testid="nc-share-view-password-change-btn"
            size="small"
            type="secondary"
            @click="openChangePasswordModal"
          >
            {{ $t('labels.changePassword') }}
          </NcButton>
        </div>

        <!-- Stored password (bcrypt-hashed): show masked locked state + change action -->
        <div v-else-if="hasStoredPassword" class="flex items-center gap-2">
          <div
            class="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium"
            data-testid="nc-share-view-password-locked"
          >
            <GeneralIcon icon="ncLock" class="text-nc-content-gray-subtle !w-3.5 !h-3.5" />
            <span class="text-nc-content-gray-subtle text-bodySm tracking-widest">••••••••</span>
          </div>
          <NcButton
            v-e="['c:share:view:password:change-open']"
            :disabled="isReadOnly"
            data-testid="nc-share-view-password-change-btn"
            size="small"
            type="secondary"
            @click="openChangePasswordModal"
          >
            {{ $t('labels.changePassword') }}
          </NcButton>
        </div>

        <!-- First-time entry: inline input + explicit Save button -->
        <div v-else class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <a-input-password
              v-model:value="newPasswordDraft"
              :placeholder="$t('placeholder.password.enter')"
              class="!rounded-lg !py-1 !bg-nc-bg-default flex-1"
              data-testid="nc-modal-share-view__password"
              size="small"
              type="password"
              autocomplete="new-password"
              name="nc-share-view-password-new"
              :readonly="isReadOnly"
              @press-enter="saveNewPassword(newPasswordDraft)"
            />
            <NcButton
              v-e="['c:share:view:password:save-new']"
              :disabled="!newPasswordDraft.trim() || isReadOnly"
              :loading="isUpdating.password"
              data-testid="nc-share-view-password-save-btn"
              size="small"
              type="primary"
              @click="saveNewPassword(newPasswordDraft)"
            >
              {{ $t('general.save') }}
            </NcButton>
          </div>
          <span class="text-bodySm text-nc-content-gray-subtle leading-snug">
            {{ $t('msg.info.viewPasswordNotVisibleAfterSave') }}
          </span>
        </div>
      </ShareCommonToggleRow>

      <ShareCommonToggleRow
        :model-value="languageSet"
        :label="$t('labels.language')"
        :loading="isUpdating.language"
        :disabled="isReadOnly"
        ve-key="c:share:view:language:toggle"
        testid="share-language-toggle"
        @update:model-value="toggleLanguageSet"
      >
        <NcSelect
          v-model:value="withLanguage"
          data-testid="nc-modal-share-view__Language"
          :options="languageOptions"
          class="nc-modal-share-view-language-select w-full"
          :disabled="isReadOnly"
        />
      </ShareCommonToggleRow>

      <ShareCommonCustomUrl
        v-if="activeView && showEEFeatures"
        :id="activeView.fk_custom_url_id"
        :backend-url="appInfo.ncSiteUrl"
        :copy-custom-url="copyCustomUrl"
        :search-query="preFillFormSearchParams && activeView?.type === ViewTypes.FORM ? `?${preFillFormSearchParams}` : ''"
        :disabled="isReadOnly"
        @update-custom-url="(custUrl: any) => persistCustomUrl(custUrl ?? null)"
      />

      <!-- Form-specific options -->
      <template v-if="isFormView">
        <NcDivider class="!my-1" />
        <div class="px-3 py-1 text-bodySm font-medium text-nc-content-gray-subtle uppercase tracking-wide">
          {{ $t('objects.viewType.form') }}
        </div>

        <ShareCommonToggleRow
          v-model="surveyMode"
          :label="$t('activity.surveyMode')"
          :tooltip="$t('tooltip.surveyFormInfo')"
          :disabled="isReadOnly"
          ve-key="c:share:view:surver-mode:toggle"
          testid="nc-modal-share-view__surveyMode"
        />

        <ShareCommonToggleRow
          :model-value="themeSet"
          label="Default Theme"
          tooltip="Set the default theme (light or dark) for this shared form."
          :disabled="isReadOnly"
          :loading="isUpdating.language"
          ve-key="c:share:view:theme:toggle"
          testid="nc-modal-share-view__themeToggle"
          @update:model-value="toggleThemeSet"
        >
          <NcSelect
            v-model:value="defaultTheme"
            data-testid="nc-modal-share-view__themeSelect"
            :options="themeOptions"
            class="nc-modal-share-view-theme-select w-full"
            :disabled="isReadOnly"
          />
        </ShareCommonToggleRow>

        <ShareCommonToggleRow
          :model-value="formPreFill.preFillEnabled"
          :label="$t('activity.preFilledFields.title')"
          :tooltip="$t('tooltip.preFillFormInfo')"
          :disabled="isReadOnly"
          ve-key="c:share:view:prefill:toggle"
          testid="nc-modal-share-view__preFill"
          @update:model-value="(val: boolean) => handleChangeFormPreFill({ preFillEnabled: val })"
        >
          <a-radio-group
            :value="formPreFill.preFilledMode"
            class="nc-modal-share-view-preFillMode"
            data-testid="nc-modal-share-view__preFillMode"
            @update:value="(val: any) => handleChangeFormPreFill({ preFilledMode: val })"
          >
            <a-radio v-for="mode of Object.values(PreFilledMode)" :key="mode" :value="mode">
              <div class="flex-1">{{ $t(`activity.preFilledFields.${mode}`) }}</div>
            </a-radio>
          </a-radio-group>
        </ShareCommonToggleRow>
      </template>
    </div>

    <NcDivider class="!my-0" />

    <div class="py-1">
      <ShareCommonMenuItem
        icon="refresh"
        :label="$t('activity.generateNewLink')"
        :disabled="isReadOnly"
        ve-key="c:share:view:regenerate"
        testid="nc-share-view-regenerate-link"
        @click="onGenerateNewLink"
      />
      <ShareCommonMenuItem
        icon="close"
        :label="$t('activity.disableLink')"
        danger
        :disabled="isReadOnly"
        :loading="isUpdating.public"
        ve-key="c:share:view:disable"
        testid="nc-share-view-disable-link"
        @click="disableLink"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-modal-share-view-preFillMode) {
  @apply flex flex-col;

  .ant-radio-wrapper {
    @apply !m-0 !flex !items-center w-full px-2 py-1 rounded-lg hover:bg-nc-bg-gray-light;
    .ant-radio {
      @apply !top-0;
    }
    .ant-radio + span {
      @apply !flex !pl-4;
    }
  }
}

:deep(.nc-modal-share-view-language-select.ant-select),
:deep(.nc-modal-share-view-theme-select.ant-select) {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}
</style>
