<script lang="ts" setup>
import { IconType, PublicAttachmentScope } from 'nocodb-sdk'

const { user } = useGlobal()

const { t } = useI18n()

const isErrored = ref(false)
const isProfileUpdating = ref(false)

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

const isSaveChangesBtnEnabled = computed(() => {
  return !!(form.value.title && form.value.title !== user.value?.display_name)
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

const onValidate = async () => {
  try {
    return await formValidator.value.validate()
  } catch {
    return false
  }
}
const getIconMeta = () => {
  return {
    ...(user.value?.meta ? parseProp(user.value.meta) : {}),
    icon:
      form.value.iconType === IconType.IMAGE && ncIsObject(form.value.icon) ? { ...form.value.icon, data: '' } : form.value.icon,
    iconType: form.value.iconType,
  }
}

const saveChanges = async (isIconUpdate = false) => {
  if (!isIconUpdate) {
    const isNameChanged = (user.value?.display_name ?? '') !== form.value.title

    if (!isNameChanged) return

    const valid = await onValidate()
    if (!valid) {
      isErrored.value = true
      return
    } else {
      isErrored.value = false
    }
  }

  isProfileUpdating.value = true

  try {
    await updateUserProfile({
      attrs: {
        ...(isIconUpdate ? { meta: getIconMeta() } : { display_name: form.value?.title }),
      },
    })
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isProfileUpdating.value = false
  }
}

const email = computed(() => user.value?.email)

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

watch(
  user,
  () => {
    if (!user.value) {
      return
    }

    if (!isErrored.value) {
      form.value.title = form.value.title || (user.value.display_name ?? '')
    }

    form.value.email = user.value.email
    form.value.icon = parseProp(user.value.meta)?.icon ?? ''
    form.value.iconType = parseProp(user.value.meta)?.iconType ?? ''
  },
  {
    immediate: true,
  },
)

const onCancel = () => {
  form.value.title = user.value?.display_name ?? ''
}
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
    <div class="h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div class="h-full nc-content-max-w p-6">
        <div class="flex flex-col w-150 mx-auto">
          <div class="nc-settings-item-card-wrapper mt-5">
            <div class="nc-settings-item-heading text-nc-content-gray-emphasis">
              {{ $t('labels.accountDetails') }}
            </div>

            <div class="nc-settings-item-card p-6">
              <a-form ref="formValidator" layout="vertical" no-style :model="form" class="w-full" @finish="() => saveChanges()">
                <div class="flex gap-4">
                  <div>
                    <GeneralIconSelector
                      v-model:icon="form.icon"
                      v-model:icon-type="form.iconType"
                      v-model:image-cropper-data="imageCropperData"
                      :default-active-tab="IconType.IMAGE"
                      :tab-order="[IconType.IMAGE, IconType.ICON, IconType.EMOJI]"
                      @submit="() => saveChanges(true)"
                    >
                      <template #default="{ isOpen }">
                        <div
                          class="border-1 w-26.25 h-26.25 flex-none rounded-full overflow-hidden transition-all duration-300 cursor-pointer"
                          :class="{
                            'border-transparent': !isOpen && form.iconType === IconType.IMAGE,
                            'border-nc-gray-medium': !isOpen && form.iconType !== IconType.IMAGE,
                            'border-primary shadow-selected': isOpen,
                          }"
                        >
                          <GeneralUserIcon
                            size="xlarge"
                            :user="user"
                            class="!w-full !h-full !min-w-full select-none cursor-pointer"
                          />
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
                <div class="flex flex-row w-full justify-end mt-8 gap-4">
                  <NcButton
                    v-if="isSaveChangesBtnEnabled"
                    type="secondary"
                    size="small"
                    data-testid="nc-account-settings-cancel"
                    :disabled="isProfileUpdating"
                    @click="onCancel"
                  >
                    {{ $t('general.cancel') }}
                  </NcButton>
                  <NcButton
                    type="primary"
                    html-type="submit"
                    size="small"
                    :disabled="isErrored || !isSaveChangesBtnEnabled || isProfileUpdating"
                    :loading="isProfileUpdating"
                    data-testid="nc-account-settings-save"
                  >
                    <template #loading> {{ $t('general.saving') }} </template>
                    {{ $t('general.save') }}
                  </NcButton>
                </div>
              </a-form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
