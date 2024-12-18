<script lang="ts" setup>
import { PublicAttachmentScope } from 'nocodb-sdk'

const { user } = useGlobal()

const { t } = useI18n()

const isErrored = ref(false)
const isTitleUpdating = ref(false)
const form = ref<{
  title: string
  email: string
  icon: string | Record<string, any>
  iconType: IconType | string
}>({
  title: '',
  email: '',
  icon: '',
  iconType: '',
})

const { updateUserProfile } = useUsers()
const formValidator = ref()

const formRules = {
  title: [
    { required: true, message: t('msg.error.nameRequired') },
    { min: 2, message: t('msg.error.nameMinLength') },
    { max: 60, message: t('msg.error.nameMaxLength') },
  ],
}

const onSubmit = async () => {
  const valid = await formValidator.value.validate()

  if (!valid) return

  if (isTitleUpdating.value) return

  isTitleUpdating.value = true
  isErrored.value = false

  try {
    await updateUserProfile({ attrs: { display_name: form.value?.title } })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isTitleUpdating.value = false
  }
}

const email = computed(() => user.value?.email)

watch(
  () => user.value?.display_name,
  () => {
    if (!user.value?.display_name) return

    form.value.title = user.value.display_name
    form.value.email = user.value.email
  },
  {
    immediate: true,
  },
)

const onValidate = async (_: any, valid: boolean) => {
  isErrored.value = !valid
}

const imageCropperData = ref<Omit<ImageCropperProps, 'showCropper'>>({
  cropperConfig: {
    stencilProps: {
      aspectRatio: 1,
      fillDefault: true,
      circlePreview: true,
    },
    minHeight: 150,
    minWidth: 150,
  },
  imageConfig: {
    src: '',
    type: 'image',
    name: 'icon',
  },
  uploadConfig: {
    path: [NOCO, 'profile', 'icon'].join('/'),
    scope: PublicAttachmentScope.PROFILEPICS,
    maxFileSize: 2 * 1024 * 1024,
  },
})
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon class="flex-none !h-5 !w-5" icon="user" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('labels.profile') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div class="flex flex-col w-150 mx-auto">
        <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2">
          <div class="flex font-medium text-base" data-rec="true">{{ $t('labels.accountDetails') }}</div>
          <div class="flex text-gray-500" data-rec="true">{{ $t('labels.controlAppearance') }}</div>
          <div class="flex flex-row mt-4">
            <div class="flex mt-1.5">
              <GeneralIconSelector
                v-model:icon="form.icon"
                v-model:icon-type="form.iconType"
                v-model:image-cropper-data="imageCropperData"
                @submit="onSubmit"
              >
                <template #default="{ isOpen }">
                  <div
                    class="rounded-lg border-1 flex-none w-26.5 h-26.5 rounded-full overflow-hidden transition-all duration-300 cursor-pointer"
                    :class="{
                      'border-transparent': !isOpen && form.iconType === IconType.IMAGE,
                      'border-nc-gray-medium': !isOpen && form.iconType !== IconType.IMAGE,
                      'border-primary shadow-selected': isOpen,
                    }"
                  >
                    <GeneralUserIcon size="xlarge" :email="user?.email" :name="user?.display_name" />
                  </div>
                </template>
              </GeneralIconSelector>
            </div>
            <div class="flex w-10"></div>
            <a-form
              ref="formValidator"
              layout="vertical"
              no-style
              :model="form"
              class="flex flex-col w-full"
              @finish="onSubmit"
              @validate="onValidate"
            >
              <div class="text-gray-800 mb-1.5" data-rec="true">{{ $t('general.name') }}</div>
              <a-form-item name="title" :rules="formRules.title">
                <a-input
                  v-model:value="form.title"
                  class="w-full !rounded-md !py-1.5"
                  :placeholder="$t('general.name')"
                  data-testid="nc-account-settings-rename-input"
                />
              </a-form-item>
              <div class="text-gray-800 mb-1.5" data-rec="true">{{ $t('labels.accountEmailID') }}</div>
              <a-input
                v-model:value="email"
                class="w-full !rounded-md !py-1.5"
                :placeholder="$t('labels.email')"
                disabled
                data-testid="nc-account-settings-email-input"
              />
              <div class="flex flex-row w-full justify-end mt-8" data-rec="true">
                <NcButton
                  type="primary"
                  html-type="submit"
                  :disabled="isErrored || (form?.title && form?.title === user?.display_name)"
                  :loading="isTitleUpdating"
                  data-testid="nc-account-settings-save"
                  @click="onSubmit"
                >
                  <template #loading> {{ $t('general.saving') }} </template>
                  {{ $t('general.save') }}
                </NcButton>
              </div>
            </a-form>
          </div>
        </div>
        <AccountDelete />
      </div>
    </div>
  </div>
</template>
