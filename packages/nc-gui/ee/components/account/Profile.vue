<script lang="ts" setup>
import { PublicAttachmentScope, IconType } from 'nocodb-sdk'

const { user } = useGlobal()

const { t } = useI18n()

const isErrored = ref(false)

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

const saveChanges = async () => {
  const valid = await formValidator.value.validate()

  if (!valid) return

  isErrored.value = false

  try {
    await updateUserProfile({
      attrs: {
        display_name: form.value?.title,
        // meta: {
        //   ...(user.value?.meta ? user.value.meta : {}),
        //   icon:
        //     form.value.iconType === IconType.IMAGE && ncIsObject(form.value.icon)
        //       ? { ...form.value.icon, data: '' }
        //       : form.value.icon,
        //   iconType: form.value.iconType,
        // },
      },
    })
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const saveChangeWithDebounce = useDebounceFn(
  async () => {
    await saveChanges()
  },
  250,
  { maxWait: 2000 },
)

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
          <div class="font-bold text-base text-nc-content-gray-emphasis" data-rec="true">{{ $t('labels.accountDetails') }}</div>
          <div class="flex text-gray-500" data-rec="true">{{ $t('labels.controlAppearance') }}</div>
          <div class="flex flex-row mt-4">
            <a-form ref="formValidator" layout="vertical" no-style :model="form" class="w-full" @finish="saveChanges">
              <div class="flex gap-4 mt-6">
                <div>
                  <GeneralIconSelector
                    v-model:icon="form.icon"
                    v-model:icon-type="form.iconType"
                    v-model:image-cropper-data="imageCropperData"
                    @submit="saveChanges"
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

                <div class="flex-1 flex flex-col gap-4">
                  <div>
                    <div class="text-gray-800 mb-2" data-rec="true">{{ $t('general.name') }}</div>
                    <a-form-item name="title" :rules="formRules.title" class="!my-0">
                      <a-input
                        v-model:value="form.title"
                        class="w-full !rounded-lg !px-4 h-10"
                        :placeholder="$t('general.name')"
                        data-testid="nc-account-settings-rename-input"
                        @update:value="saveChangeWithDebounce"
                      />
                    </a-form-item>
                  </div>
                  <div>
                    <div class="text-gray-800 mb-2" data-rec="true">{{ $t('labels.accountEmailID') }}</div>
                    <a-input
                      v-model:value="email"
                      class="w-full !rounded-lg !px-4 h-10"
                      :placeholder="$t('labels.email')"
                      disabled
                      data-testid="nc-account-settings-email-input"
                    />
                  </div>
                </div>
              </div>
            </a-form>
          </div>
        </div>
        <AccountDelete />
      </div>
    </div>
  </div>
</template>
