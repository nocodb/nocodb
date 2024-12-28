<script lang="ts" setup>
const { api, error } = useApi({ useGlobalInstance: true })

const { t } = useI18n()

const { signOut } = useGlobal()

const formValidator = ref()

const form = reactive({
  currentPassword: '',
  password: '',
  passwordRepeat: '',
})

const formRules = {
  currentPassword: [{ required: true, message: t('msg.error.signUpRules.passwdRequired') }],
  password: [
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
    { min: 8, message: t('msg.error.signUpRules.passwdLength') },
  ],
  passwordRepeat: [
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
    {
      validator: (_: unknown, _v: string) => {
        return new Promise((resolve, reject) => {
          if (form.password === form.passwordRepeat) return resolve(true)
          reject(new Error(t('msg.error.signUpRules.passwdMismatch')))
        })
      },
      message: t('msg.error.signUpRules.passwdMismatch'),
    },
  ],
}

const passwordChange = async () => {
  const valid = formValidator.value.validate()
  if (!valid) return

  error.value = null

  await api.auth.passwordChange({
    currentPassword: form.currentPassword,
    newPassword: form.password,
  })

  message.success(t('msg.success.passwordChanged'))

  await signOut({
    redirectToSignin: true,
  })
}

const resetError = () => {
  if (error.value) error.value = null
}
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="passwordChange" class="flex-none text-gray-700 text-[20px] h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('activity.changePwd') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div class="flex flex-col gap-6 w-150 mx-auto">
        <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2">
          <div class="relative flex flex-col justify-start gap-2 w-full">
            <a-form
              ref="formValidator"
              data-testid="nc-user-settings-form"
              layout="vertical"
              class="change-password"
              no-style
              :model="form"
              @finish="passwordChange"
            >
              <Transition name="layout">
                <div v-if="error" class="mx-auto mb-4 bg-red-500 text-white rounded-lg w-3/4 p-1">
                  <div data-testid="nc-user-settings-form__error" class="flex items-center gap-2 justify-center" data-rec="true">
                    <MaterialSymbolsWarning />
                    {{ error }}
                  </div>
                </div>
              </Transition>

              <a-form-item
                :label="$t('placeholder.password.current')"
                data-rec="true"
                name="currentPassword"
                :rules="formRules.currentPassword"
              >
                <a-input-password
                  v-model:value="form.currentPassword"
                  data-testid="nc-user-settings-form__current-password"
                  class="password"
                  :placeholder="$t('placeholder.password.current')"
                  @focus="resetError"
                />
              </a-form-item>

              <a-form-item :label="$t('placeholder.password.new')" data-rec="true" name="password" :rules="formRules.password">
                <a-input-password
                  v-model:value="form.password"
                  data-testid="nc-user-settings-form__new-password"
                  class="password"
                  :placeholder="$t('placeholder.password.new')"
                  @focus="resetError"
                />
              </a-form-item>

              <a-form-item
                :label="$t('placeholder.password.confirm')"
                data-rec="true"
                name="passwordRepeat"
                :rules="formRules.passwordRepeat"
              >
                <a-input-password
                  v-model:value="form.passwordRepeat"
                  data-testid="nc-user-settings-form__new-password-repeat"
                  class="password"
                  :placeholder="$t('placeholder.password.confirm')"
                  @focus="resetError"
                />
              </a-form-item>

              <div class="text-right mt-5">
                <NcButton size="small" data-testid="nc-user-settings-form__submit" html-type="submit">
                  <div class="flex justify-center items-center gap-2" data-rec="true">
                    <component :is="iconMap.passwordChange" />
                    {{ $t('activity.changePwd') }}
                  </div>
                </NcButton>
              </div>
            </a-form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.change-password {
  @apply w-full flex flex-col gap-4;

  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none rounded-lg;
  }

  .ant-input-affix-wrapper {
    @apply h-10;
  }

  .password {
    input {
      @apply !border-none !m-0;
    }
  }

  :deep(.ant-form-item-label > label) {
    @apply !text-sm font-default mb-2 text-gray-700 flex;

    &.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
      @apply content-[''] m-0;
    }
  }

  :deep(.ant-form-item-label) {
    @apply !pb-0 text-small leading-[18px] text-gray-700;
  }

  :deep(.ant-form-item-control-input) {
    @apply !min-h-min;
  }

  :deep(.ant-form-item) {
    @apply !mb-0;
  }

  :deep(.ant-form-item-explain) {
    @apply !text-[10px] leading-normal;

    & > div:first-child {
      @apply mt-0.5;
    }
  }

  :deep(.ant-form-item-explain) {
    @apply !min-h-[15px];
  }
}
</style>
