<script setup lang="ts">
definePageMeta({
  requiresAuth: true,
  title: 'title.requestEditAccess',
})

const route = useRoute()
const { $api } = useNuxtApp()
const { t } = useI18n()
const { navigateToProject, signedIn } = useGlobal()

useSidebar('nc-left-sidebar', { hasSidebar: false })

const sharedBaseUuid = computed(() => {
  const value = route.query.base
  return typeof value === 'string' ? value.trim() : ''
})

const isLoading = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref('')
const requestMessage = ref('')
const statusPayload = ref<Record<string, any> | null>(null)

const status = computed(() => statusPayload.value?.status ?? null)
const alreadyHasAccess = computed(() => !!statusPayload.value?.already_has_access)
const canSubmit = computed(() => !status.value || status.value === 'rejected')

const goToBase = () => {
  const baseId = statusPayload.value?.base_id
  if (!baseId) return
  navigateToProject({
    baseId,
    workspaceId: statusPayload.value?.fk_workspace_id || 'nc',
  })
}

const loadStatus = async () => {
  if (!sharedBaseUuid.value) {
    errorMessage.value = t('msg.error.sharedBaseUuidRequired')
    isLoading.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const { data } = await $api.instance.get(`/api/v2/meta/shared-bases/${sharedBaseUuid.value}/access-requests`)
    statusPayload.value = data

    if (data?.already_has_access || data?.status === 'approved') {
      goToBase()
    }
  } catch (e: any) {
    errorMessage.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}

const submitRequest = async () => {
  if (!sharedBaseUuid.value || isSubmitting.value) return

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const { data } = await $api.instance.post(`/api/v2/meta/shared-bases/${sharedBaseUuid.value}/access-requests`, {
      message: requestMessage.value?.trim() || undefined,
    })
    statusPayload.value = data

    if (data?.already_has_access || data?.status === 'approved') {
      message.success(t('msg.success.alreadyHasEditAccess'))
      goToBase()
      return
    }

    message.success(t('msg.success.accessRequestSubmitted'))
  } catch (e: any) {
    errorMessage.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  if (!signedIn.value) return
  await loadStatus()
})
</script>

<template>
  <div class="h-full min-h-[600px] flex flex-col justify-center items-center bg-nc-bg-gray-extralight px-4">
    <div
      class="w-full max-w-[520px] bg-nc-bg-default border border-nc-border-gray-medium rounded-2xl shadow-sm p-8 flex flex-col gap-4"
    >
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-nc-bg-brand flex items-center justify-center">
          <GeneralIcon icon="edit" class="h-5 w-5 text-nc-content-brand" />
        </div>
        <div>
          <h1 class="text-xl font-semibold text-nc-content-gray m-0">
            {{ $t('title.requestEditAccess') }}
          </h1>
          <p class="text-sm text-nc-content-gray-subtle2 m-0 mt-1">
            {{ $t('msg.info.requestEditAccessDescription') }}
          </p>
        </div>
      </div>

      <div v-if="isLoading" class="py-10 flex justify-center">
        <GeneralLoader size="xlarge" />
      </div>

      <template v-else>
        <a-alert v-if="errorMessage" type="error" show-icon :message="errorMessage" class="!rounded-lg" />

        <div
          v-else-if="status === 'pending'"
          class="rounded-xl border border-nc-border-gray-medium bg-nc-bg-gray-extralight p-4 flex flex-col gap-2"
        >
          <div class="font-semibold text-nc-content-gray">
            {{ $t('msg.info.accessRequestPendingTitle') }}
          </div>
          <div class="text-sm text-nc-content-gray-subtle">
            {{ $t('msg.info.accessRequestPendingDescription') }}
          </div>
          <NcButton size="small" type="secondary" class="self-start mt-2" @click="loadStatus">
            {{ $t('general.refresh') }}
          </NcButton>
        </div>

        <div
          v-else-if="alreadyHasAccess"
          class="rounded-xl border border-nc-border-gray-medium bg-nc-bg-gray-extralight p-4 flex flex-col gap-3"
        >
          <div class="text-sm text-nc-content-gray-subtle">
            {{ $t('msg.info.alreadyHasEditAccess') }}
          </div>
          <NcButton size="small" type="primary" class="self-start" @click="goToBase">
            {{ $t('activity.openBase') }}
          </NcButton>
        </div>

        <template v-else-if="canSubmit">
          <a-alert
            v-if="status === 'rejected'"
            type="warning"
            show-icon
            :message="$t('msg.info.accessRequestRejectedTitle')"
            :description="$t('msg.info.accessRequestRejectedDescription')"
            class="!rounded-lg"
          />

          <a-textarea
            v-model:value="requestMessage"
            :rows="4"
            :placeholder="$t('placeholder.accessRequestMessage')"
            class="!rounded-lg"
          />

          <NcButton
            type="primary"
            size="medium"
            :loading="isSubmitting"
            data-testid="nc-submit-access-request"
            @click="submitRequest"
          >
            {{ $t('activity.requestEditAccess') }}
          </NcButton>
        </template>
      </template>

      <NuxtLink
        v-if="sharedBaseUuid"
        :to="`/base/${sharedBaseUuid}`"
        class="text-sm text-nc-content-brand hover:underline self-start"
      >
        {{ $t('activity.backToSharedBase') }}
      </NuxtLink>
    </div>
  </div>
</template>
