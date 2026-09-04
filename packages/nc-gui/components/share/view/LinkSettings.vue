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
  confirmDisableLink,
} = popover

const onGenerateNewLink = () => {
  if (isReadOnly.value) return
  goTo('regenerate-confirm')
}

const onDisableLink = () => {
  if (isReadOnly.value) return
  confirmDisableLink('link-settings')
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
        icon="download"
        :label="$t('activity.allowDownload')"
        :description="$t('activity.allowDownloadDescription')"
        :loading="isUpdating.download"
        :disabled="isReadOnly"
        ve-key="c:share:view:allow-csv-download:toggle"
        testid="share-download-toggle"
      />

      <ShareCommonToggleRow
        :model-value="passwordProtected"
        icon="ncLock"
        :label="$t('activity.restrictAccessWithPassword')"
        :description="$t('activity.passwordRequiredToView')"
        :loading="isUpdating.password"
        :disabled="isReadOnly"
        ve-key="c:share:view:password:toggle"
        testid="share-password-toggle"
        @update:model-value="togglePasswordProtected"
      >
        <ShareCommonPasswordField
          v-model="newPasswordDraft"
          scope="view"
          :legacy-password="activeView?.password"
          :is-legacy="isLegacyPlaintextPassword"
          :has-stored="hasStoredPassword"
          :disabled="isReadOnly"
          :saving="isUpdating.password"
          @save="saveNewPassword"
          @change-password="openChangePasswordModal"
        />
      </ShareCommonToggleRow>

      <ShareCommonToggleRow
        :model-value="languageSet"
        icon="ncGlobe"
        :label="$t('activity.forceLanguage')"
        :description="$t('activity.forceLanguageDescription')"
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
        :is-saving="isUpdating.customUrl"
        @update-custom-url="(custUrl: any) => persistCustomUrl(custUrl ?? null)"
      />

      <!-- Form-specific options -->
      <template v-if="isFormView">
        <NcDivider class="!my-1" />
        <div class="px-3 py-1 text-bodySm text-nc-content-gray-subtle uppercase tracking-wide">
          {{ $t('objects.viewType.form') }}
        </div>

        <ShareCommonToggleRow
          v-model="surveyMode"
          icon="ncList"
          :label="$t('activity.surveyMode')"
          :description="$t('tooltip.surveyFormInfo')"
          :disabled="isReadOnly"
          ve-key="c:share:view:surver-mode:toggle"
          testid="nc-modal-share-view__surveyMode"
        />

        <ShareCommonToggleRow
          :model-value="themeSet"
          icon="ncPalette"
          :label="$t('activity.defaultTheme')"
          :description="$t('activity.defaultThemeDescription')"
          :disabled="isReadOnly"
          :loading="isUpdating.theme"
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
          icon="ncEdit"
          :label="$t('activity.preFilledFields.title')"
          :description="$t('activity.preFilledFields.description')"
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
        :icon-badge="false"
        :label="$t('activity.generateNewLink')"
        :disabled="isReadOnly"
        ve-key="c:share:view:regenerate"
        testid="nc-share-view-regenerate-link"
        @click="onGenerateNewLink"
      />
      <ShareCommonMenuItem
        icon="close"
        :icon-badge="false"
        :label="$t('activity.disableLink')"
        danger
        :disabled="isReadOnly"
        :loading="isUpdating.public"
        ve-key="c:share:view:disable"
        testid="nc-share-view-disable-link"
        @click="onDisableLink"
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
