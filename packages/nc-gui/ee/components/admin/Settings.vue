<script lang="ts" setup>
import { IconType, PublicAttachmentScope } from 'nocodb-sdk'

const orgStore = useOrg()

const { t } = useI18n()

const { org } = storeToRefs(orgStore)
const { updateOrg } = orgStore

const isErrored = ref(false)
const isOrganizationUpdating = ref(false)

const form = ref<{
  title: string

  icon: string | Record<string, any>
  iconType: IconType | string
}>({
  title: '',
  icon: '',
  iconType: '',
})

const isSaveChangesBtnEnabled = computed(() => {
  return !!(form.value.title && form.value.title !== org.value?.title)
})

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
    ...(org.value?.meta ? parseProp(org.value.meta) : {}),
    icon:
      form.value.iconType === IconType.IMAGE && ncIsObject(form.value.icon) ? { ...form.value.icon, data: '' } : form.value.icon,
    iconType: form.value.iconType,
  }
}

const saveChanges = async (isIconUpdate = false, showToastMsg = true) => {
  if (!isIconUpdate) {
    const isNameChanged = (org.value?.display_name ?? '') !== form.value.title

    if (!isNameChanged) return

    const valid = await onValidate()
    if (!valid) {
      isErrored.value = true
      return
    } else {
      isErrored.value = false
    }
  }

  isOrganizationUpdating.value = true

  try {
    await updateOrg(
      {
        ...org.value,
        ...(isIconUpdate ? { meta: getIconMeta() } : { title: form.value?.title }),
      },
      showToastMsg,
    )
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isOrganizationUpdating.value = false
  }
}

const imageCropperData = ref<Omit<ImageCropperProps, 'showCropper'>>({
  cropperConfig: {
    stencilProps: {
      aspectRatio: 1,
      fillDefault: true,
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
    path: [NOCO, 'org', org.value?.id, 'icon'].join('/'),
    scope: PublicAttachmentScope.ORGANIZATIONPICS,
    maxFileSize: 2 * 1024 * 1024,
  },
})

const inputEl = ref()

const router = useRoute()

onMounted(() => {
  if (router.query.isCreatedFromWorkspace) {
    setTimeout(() => {
      inputEl.value.focus()
    }, 100)
  }
})

watch(
  org,
  (val) => {
    if (!val) {
      return
    }

    if (!isErrored.value) {
      form.value.title = form.value.title || (val?.title ?? '')
    }

    form.value.icon = val.meta?.icon ?? ''
    form.value.iconType = val.meta?.iconType ?? ''
  },
  {
    immediate: true,
  },
)

const onCancel = () => {
  form.value.title = org.value?.title ?? ''
}
</script>

<template>
  <div class="flex flex-col" data-test-id="nc-admin-settings">
    <div class="nc-breadcrumb px-2">
      <div class="nc-breadcrumb-item">
        {{ org.title }}
      </div>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
      <div class="nc-breadcrumb-item active">
        {{ $t('labels.settings') }}
      </div>
    </div>
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncSettings" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('labels.settings') }}
        </span>
      </template>
    </NcPageHeader>

    <div
      class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6"
    >
      <div v-if="org" class="flex flex-col gap-6 w-150">
        <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6">
          <div class="font-bold text-base" data-rec="true">
            {{ $t('labels.organizationProfile') }}
          </div>
          <span class="text-gray-600 mt-2">
            {{ $t('msg.controlOrgAppearance') }}
          </span>

          <a-form ref="formValidator" layout="vertical" no-style :model="form" class="w-full" @finish="() => saveChanges()">
            <div class="flex gap-4 mt-6">
              <div>
                <GeneralIconSelector
                  v-model:icon="form.icon"
                  v-model:icon-type="form.iconType"
                  v-model:image-cropper-data="imageCropperData"
                  @submit="() => saveChanges(true)"
                >
                  <template #default="{ isOpen }">
                    <div
                      class="border-1 w-17 h-17 flex-none rounded-lg overflow-hidden transition-all duration-300 cursor-pointer flex items-center justify-center"
                      :class="{
                        'border-transparent': !isOpen && form.iconType === IconType.IMAGE,
                        'border-nc-gray-medium': !isOpen && form.iconType !== IconType.IMAGE,
                        'border-primary shadow-selected': isOpen,
                        'bg-gray-100': !org?.meta?.icon,
                      }"
                    >
                      <GeneralWorkspaceIcon
                        v-if="org?.meta?.icon"
                        size="xlarge"
                        :workspace="org"
                        class="flex-none !w-full !h-full !min-w-full !rounded-lg select-none cursor-pointer"
                      />
                      <component :is="iconMap.office" v-else class="w-8 !fill-gray-600 h-8" />
                    </div>
                  </template>
                </GeneralIconSelector>
              </div>

              <div class="flex-1 flex flex-col gap-4">
                <div>
                  <div class="text-gray-800 mb-2" data-rec="true">{{ $t('labels.organizationName') }}</div>
                  <a-form-item name="title" :rules="formRules.title" class="!my-0">
                    <a-input
                      ref="inputEl"
                      v-model:value="form.title"
                      class="w-full !rounded-lg !px-4 h-10"
                      placeholder="Acme Inc"
                    />
                  </a-form-item>
                </div>
              </div>
            </div>
            <div class="flex flex-row w-full justify-end mt-8 gap-4">
              <NcButton
                v-if="isSaveChangesBtnEnabled"
                type="secondary"
                size="small"
                data-testid="nc-organization-settings-cancel"
                :disabled="isOrganizationUpdating"
                @click="onCancel"
              >
                {{ $t('general.cancel') }}
              </NcButton>
              <NcButton
                type="primary"
                html-type="submit"
                size="small"
                :disabled="isErrored || !isSaveChangesBtnEnabled || isOrganizationUpdating"
                :loading="isOrganizationUpdating"
                data-testid="nc-organization-settings-submit"
              >
                <template #loading> {{ $t('general.saving') }} </template>
                {{ $t('general.save') }}
              </NcButton>
            </div>
          </a-form>
        </div>
        <!--
      <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6">
        <div class="font-bold text-base" data-rec="true">
          {{ $t('labels.domains') }}
        </div>
        <span class="text-gray-600 mt-2">
          {{ $t('msg.addCompanyDomains') }}
        </span>
        <a-divider class="text-gray-200" />
        <span class="text-gray-800 mb-3 font-bold">
          {{ $t('labels.activeDomains') }}
        </span>
        <div class="flex gap-3">
          <NcBadge v-for="x in domains" :key="x" class="w-28" rounded="lg" size="md">
            <div class="flex justify-between text-gray-600 gap-1 items-center">
              {{ x }}
              <component :is="iconMap.close" class="cursor-pointer" @click="deleteDomain(x)" />
            </div>
          </NcBadge>

          <NcButton size="small" type="secondary">
            <component :is="iconMap.plus" />
            {{ $t('activity.addDomain') }}
          </NcButton>
        </div>
      </div> -->

        <!-- <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6">
        <div class="font-bold text-base" data-rec="true">
          {{ $t('labels.shareSettings') }}
        </div>
        <a-divider class="text-gray-200" />
        <div class="flex flex-col px-2 py-3 gap-2 border-1 rounded-lg border-gray-200">
          <div class="flex items-center justify-between">
            <span class="text-gray-800 font-bold text-base">
              {{ $t('labels.disablePublicSharing') }}
            </span>

            <NcSwitch v-model:checked="isPublicSharingDisabled" size="default"> </NcSwitch>
          </div>
          <span>
            {{ $t('msg.restrictUsersFromSharing') }}
          </span>
        </div>
      </div>

      <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6" data-test-id="nc-oidc-provider">
        <div class="flex font-bold justify-between text-gray-900 text-base" data-rec="true">
          {{ $t('labels.userOptions') }}
        </div>
        <a-divider class="text-gray-200" />
        <div class="flex gap-2 flex-col">
          <div class="flex justify-between">
            <span class="text-gray-800 font-bold"> {{ $t('labels.deleteUserAndData') }} </span>
            <component :is="iconMap.chevronRight" />
          </div>
          <span class="text-gray-500">
            {{ $t('msg.selectUsersToBeRemoved') }}
          </span>
        </div>
      </div> -->

        <!--      <div class="flex flex-col border-1 rounded-2xl border-red-500 p-6" data-test-id="nc-oidc-provider">
        <div class="flex font-bold justify-between text-red-500 text-base" data-rec="true">
          {{ $t('labels.dangerZone') }}
        </div>
        <a-divider class="text-gray-200" />
        <div class="flex gap-2 flex-col">
          <div class="flex justify-between">
            <span class="text-gray-800 font-bold"> {{ $t('labels.deleteThisOrganization') }} </span>
            <component :is="iconMap.chevronRight" />
          </div>
          <span class="text-gray-500">
            {{ $t('msg.deleteOrganization') }}
          </span>
        </div>
      </div> -->
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input {
  @apply px-4 rounded-lg py-2 w-full border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
