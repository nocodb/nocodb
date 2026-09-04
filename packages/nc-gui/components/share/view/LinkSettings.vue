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
} = popover

const onGenerateNewLink = () => {
  if (isReadOnly.value) return
  goTo('regenerate-confirm')
}

const onDisableLink = () => {
  if (isReadOnly.value) return
  goTo('disable-confirm')
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
        <!-- Legacy plaintext password (pre-bcrypt migration) — show as-is so owner can read it -->
        <div
          v-if="isLegacyPlaintextPassword"
          class="nc-share-password-row flex items-stretch h-9 bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg overflow-hidden shadow-default hover:border-nc-border-gray-dark transition-colors"
          @click.stop
        >
          <a-input-password
            :value="activeView?.password"
            class="nc-share-password-input flex-1 min-w-0 !bg-transparent"
            data-testid="nc-share-view-password-legacy"
            size="small"
            readonly
            :bordered="false"
            autocomplete="off"
            name="nc-share-view-password-legacy"
          />
          <button
            v-e="['c:share:view:password:change-open']"
            type="button"
            :disabled="isReadOnly"
            data-testid="nc-share-view-password-change-btn"
            class="nc-share-password-action flex items-center gap-1.5 px-3 text-bodySm font-weight-600 border-l-1 border-nc-border-gray-light bg-nc-bg-gray-extralight text-nc-content-gray-extreme hover:bg-nc-bg-gray-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            @click="openChangePasswordModal"
          >
            <GeneralIcon icon="ncEdit" class="flex-none !w-3.5 !h-3.5" />
            <span>{{ $t('labels.changePassword') }}</span>
          </button>
        </div>

        <!-- Stored password (bcrypt-hashed): show masked locked state + change action -->
        <div
          v-else-if="hasStoredPassword"
          class="nc-share-password-row flex items-stretch h-9 bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg overflow-hidden shadow-default hover:border-nc-border-gray-dark transition-colors"
          data-testid="nc-share-view-password-locked"
          @click.stop
        >
          <div class="flex-1 min-w-0 flex items-center gap-2 px-3">
            <GeneralIcon icon="ncLock" class="text-nc-content-gray-subtle !w-3.5 !h-3.5 flex-none" />
            <span class="text-nc-content-gray-subtle text-bodySm tracking-widest truncate">••••••••</span>
          </div>
          <button
            v-e="['c:share:view:password:change-open']"
            type="button"
            :disabled="isReadOnly"
            data-testid="nc-share-view-password-change-btn"
            class="nc-share-password-action flex items-center gap-1.5 px-3 text-bodySm font-weight-600 border-l-1 border-nc-border-gray-light bg-nc-bg-gray-extralight text-nc-content-gray-extreme hover:bg-nc-bg-gray-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            @click="openChangePasswordModal"
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
              v-model:value="newPasswordDraft"
              :placeholder="$t('placeholder.password.enter')"
              class="nc-share-password-input flex-1 min-w-0 !bg-transparent"
              data-testid="nc-modal-share-view__password"
              size="small"
              type="password"
              :bordered="false"
              autocomplete="new-password"
              name="nc-share-view-password-new"
              :readonly="isReadOnly"
              aria-describedby="nc-share-view-password-help"
              @press-enter="saveNewPassword(newPasswordDraft)"
            />
            <button
              v-e="['c:share:view:password:save-new']"
              type="button"
              :disabled="!newPasswordDraft.trim() || isReadOnly || isUpdating.password"
              data-testid="nc-share-view-password-save-btn"
              class="nc-share-password-action flex items-center justify-center gap-1.5 px-4 text-bodySm font-weight-600 border-l-1 border-nc-border-gray-light transition-colors disabled:(opacity-60 cursor-not-allowed)"
              :class="
                newPasswordDraft.trim()
                  ? 'bg-brand-500 text-white border-brand-500 md:(hover:bg-brand-600)'
                  : 'bg-nc-bg-gray-extralight text-nc-content-gray-extreme hover:bg-nc-bg-gray-light'
              "
              @click="saveNewPassword(newPasswordDraft)"
            >
              <GeneralLoader v-if="isUpdating.password" size="small" class="!bg-inherit !text-inherit" />
              <span>{{ $t('general.save') }}</span>
            </button>
          </div>
          <span id="nc-share-view-password-help" class="text-bodySm text-nc-content-gray-subtle leading-snug">
            {{ $t('msg.info.viewPasswordNotVisibleAfterSave') }}
          </span>
        </div>
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
