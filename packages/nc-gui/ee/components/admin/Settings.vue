<script lang="ts" setup>
const orgStore = useOrg()

const { org } = storeToRefs(orgStore)
const { updateOrg, loadOrg } = orgStore

const { getPossibleAttachmentSrc } = useAttachment()

const { open, onChange: onChangeFile } = useFileDialog({
  accept: 'image/*',
  multiple: false,
  reset: true,
})

const form = ref({
  title: '',
})

watch(
  () => org.value,
  (val) => {
    form.value.title = val?.title
  },
)

onMounted(async () => {
  form.value.title = org.value?.title
})

const save = async () => {
  await updateOrg({
    ...org.value,
    title: form.value.title,
  })
}

const imageCropperData = ref({
  cropperConfig: {
    stencilProps: {
      aspectRatio: undefined,
    },
    minHeight: 150,
    minWidth: 150,
  },
  imageConfig: {
    src: org.value?.image,
    type: 'image',
    name: 'icon',
  },
  uploadConfig: {
    path: [NOCO, 'org', org.value?.id, 'icon'].join('/'),
  },
})

const handleOnUploadImage = async (data: any) => {
  await updateOrg({
    ...org.value,
    image: data,
  })

  await loadOrg()
}

const openUploadImage = () => {
  imageCropperData.value.uploadConfig = {
    path: [NOCO, 'org', org.value.id, 'icon'].join('/'),
  }

  imageCropperData.value.cropperConfig = {
    ...imageCropperData.value.cropperConfig,
    stencilProps: {
      aspectRatio: 1,
    },
    minHeight: 150,
    minWidth: 150,
  }
  open()
}

const showImageCropper = ref(false)

const getOrgLogoSrc = computed(() => getPossibleAttachmentSrc(parseProp(org.value.image)))

onChangeFile((files) => {
  if (files && files[0]) {
    // 1. Revoke the object URL, to allow the garbage collector to destroy the uploaded before file
    if (imageCropperData.value.imageConfig.src) {
      URL.revokeObjectURL(imageCropperData.value.imageConfig.src)
    }
    // 2. Create the blob link to the file to optimize performance:
    const blob = URL.createObjectURL(files[0])

    // 3. Update the image. The type will be derived from the extension
    imageCropperData.value.imageConfig = {
      src: blob,
      type: files[0].type,
      name: files[0].name,
    }

    showImageCropper.value = true
  }
})

const removeImage = async () => {
  await updateOrg({
    ...org.value,
    image: '',
  })
}

const inputEl = ref()

const router = useRoute()

onMounted(() => {
  if (router.query.isCreatedFromWorkspace) {
    setTimeout(() => {
      inputEl.value.focus()
    }, 100)
  }
})
</script>

<template>
  <div class="flex flex-col" data-test-id="nc-admin-settings">
    <GeneralImageCropper
      v-model:show-cropper="showImageCropper"
      :cropper-config="imageCropperData.cropperConfig"
      :image-config="imageCropperData.imageConfig"
      :upload-config="imageCropperData.uploadConfig"
      @submit="handleOnUploadImage"
    ></GeneralImageCropper>
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
        <div class="flex justify-center items-center h-5 w-5">
          <GeneralIcon icon="settings" class="flex-none text-[20px]" />
        </div>
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('labels.settings') }}
        </span>
      </template>
    </NcPageHeader>

    <div
      class="flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6 border-t-1 border-gray-200"
    >
      <div v-if="org" class="flex flex-col gap-6 w-150">
        <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6">
          <div class="font-bold text-base" data-rec="true">
            {{ $t('labels.organizationProfile') }}
          </div>
          <span class="text-gray-600 mt-2">
            {{ $t('msg.controlOrgAppearance') }}
          </span>
          <a-divider class="text-gray-200" />
          <span class="text-gray-800 mb-3 font-bold">
            {{ $t('labels.organizationImage') }}
          </span>
          <div class="flex items-center mb-5 space-x-3">
            <div class="border-1 bg-gray-100 border-gray-200 w-16 flex items-center justify-center h-16 rounded-xl">
              <img
                v-if="org.image"
                :src="getOrgLogoSrc"
                :srcset="getOrgLogoSrc"
                alt="Organization Logo"
                class="w-16 h-16 rounded-xl"
              />
              <component :is="iconMap.office" v-else class="w-8 !fill-gray-600 h-8" />
            </div>
            <NcButton data-testid="nc-admin-settings-org-icon-btn" size="small" type="secondary" @click="openUploadImage">
              <div class="flex gap-2 items-center">
                <span>
                  <component :is="iconMap.upload" class="w-4 h-4" />

                  {{ org.image ? $t('general.replace') : $t('general.upload') }}
                </span>
              </div>
            </NcButton>

            <NcButton
              v-if="org.image"
              data-testid="nc-admin-settings-org-icon-remove-btn"
              size="small"
              type="secondary"
              @click="removeImage"
            >
              <div class="flex gap-2 items-center">
                <component :is="iconMap.delete" class="w-4 h-4" />
                {{ $t('general.remove') }}
              </div>
            </NcButton>
          </div>
          <span class="text-gray-800 mb-3 font-bold">
            {{ $t('labels.organizationName') }}
          </span>
          <a-input ref="inputEl" v-model:value="form.title" class="w-96" placeholder="Acme Inc" />
          <div class="flex justify-end mt-3">
            <NcButton type="primary" @click="save">
              {{ $t('general.save') }}
            </NcButton>
          </div>
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
