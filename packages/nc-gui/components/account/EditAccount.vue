<script lang="ts" setup>
import { iconMap, computed, message, navigateTo, reactive, ref, useApi, useGlobal, useI18n } from '#imports'

const { api, error } = useApi({ useGlobalInstance: true })
const { isLoading, user, currentVersion } = useGlobal()
const { t } = useI18n()

const username = user.value?.username
const firstname = user.value?.firstname
const lastname = user.value?.lastname



const formValidator = ref()

const form = reactive({
  username: username,
  lastname: lastname,
  firstname: firstname,
})

const formRules = {
  username: [
    // Current password is required
    { required: false, message: t('msg.error.signUpRules.passwdRequired') },
  ],
  lastname: [
    // Password is required
    { required: false, message: t('msg.error.signUpRules.passwdRequired') },
  ],
  firstname: [
    // PasswordRepeat is required
    { required: false, message: t('msg.error.signUpRules.passwdRequired') },
    // Passwords match
  ],
}

const userEdit = async () => {
  const valid = formValidator.value.validate()
  if (!valid) return

  error.value = null

  await api.orgUsers.userEdit({
    username: form.username,
    lastname: form.lastname,
    firstname: form.firstname
  })

  message.success(t('msg.success.passwordChanged'))


  navigateTo('/users/list')
}

const resetError = () => {
  if (error.value) error.value = null
}
</script>

<template>
  <div class="mx-auto relative flex flex-col justify-start gap-2 w-full px-8 md:(bg-white) max-w-[900px]">
    <div class="text-xl my-4 text-left font-weight-bold">{{ 'Edit User' }}</div>
    <a-form
      ref="formValidator"
      data-testid="nc-user-settings-form"
      layout="vertical"
      class="change-password lg:max-w-3/4 w-full"
      no-style
      :model="form"
      @finish="userEdit"
    >
      <Transition name="layout">
        <div v-if="error" class="mx-auto mb-4 bg-red-500 text-white rounded-lg w-3/4 p-1">
          <div data-testid="nc-user-settings-form__error" class="flex items-center gap-2 justify-center">
            <MaterialSymbolsWarning />
            {{ error }}
          </div>
        </div>
      </Transition>

      <a-form-item :label="$t('Username')" name="username" :rules="formRules.username">
        <a-input
          v-model:value="form.username"
          data-testid="nc-user-settings-form__username"
          size="large"
          class="text"
          @focus="resetError"
        />
      </a-form-item>

      <a-form-item :label="$t('Lastname')" name="lastname" :rules="formRules.lastname">
        <a-input
          v-model:value="form.lastname"
          data-testid="nc-user-settings-form__lastname"
          size="large"
          class="text"
          @focus="resetError"
        />
      </a-form-item>

      <a-form-item :label="$t('Firstname')" name="firstname" :rules="formRules.firstname">
        <a-input
          v-model:value="form.firstname"
          data-testid="nc-user-settings-form__firstname"
          size="large"
          class="text"
          @focus="resetError"
        />
      </a-form-item>

      <div class="text-right">
        <a-button
          size="middle"
          data-testid="nc-user-settings-form__submit"
          class="!rounded-md !h-[2.5rem]"
          type="primary"
          html-type="submit"
        >
          <div class="flex justify-center items-center gap-2">
            {{ $t('activity.editUser') }}
          </div>
        </a-button>
      </div>
    </a-form>
  </div>
</template>

<style lang="scss">
.change-password {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none my-1 border-1 border-solid border-primary border-opacity-50 rounded;
  }

  .password {
    input {
      @apply !border-none !m-0;
    }
  }
}
</style>