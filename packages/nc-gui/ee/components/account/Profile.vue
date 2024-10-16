<script lang="ts" setup>
import type { ApiTokenType, BaseType, IntegrationType, SourceType, WorkspaceType } from 'nocodb-sdk'

const { user, signOut } = useGlobal()

const { t } = useI18n()

const { $api } = useNuxtApp()

const isErrored = ref(false)
const isTitleUpdating = ref(false)
const form = ref({
  title: '',
  email: '',
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
    console.error(e)
  } finally {
    isTitleUpdating.value = false
  }
}

const toBeDeleted = ref<
  {
    workspaces: WorkspaceType[]
    bases: BaseType[]
    integrations: IntegrationType[]
    sources: SourceType[]
    apiTokens: ApiTokenType[]
  } & any
>()

const entities = [
  {
    title: 'Workspaces',
    key: 'workspaces',
    titleKey: 'title',
  },
  {
    title: 'Bases',
    key: 'bases',
    titleKey: 'title',
  },
  {
    title: 'Integrations',
    key: 'integrations',
    titleKey: 'title',
  },
  {
    title: 'Sources',
    key: 'sources',
    titleKey: 'alias',
  },
  {
    title: 'API Tokens',
    key: 'apiTokens',
    titleKey: 'description',
  },
]

const loadingToBeDeleted = ref(false)

let loadingToBeDeletedTimeout: number

const onInitDelete = async () => {
  if (loadingToBeDeleted.value) return

  loadingToBeDeleted.value = true

  try {
    const res = (await $api.user.delete({
      dry: true,
    })) as any

    toBeDeleted.value = res

    loadingToBeDeletedTimeout = setTimeout(() => {
      toBeDeleted.value = undefined
    }, 10 * 60 * 1000)
  } catch (e: any) {
    console.error(e)
  } finally {
    loadingToBeDeleted.value = false
  }
}

const onDelete = async () => {
  if (loadingToBeDeleted.value) return

  loadingToBeDeleted.value = true

  Modal.confirm({
    title: 'Are you sure you want to delete your account?',
    type: 'warn',
    content:
      'This action is irreversible. All your data will be deleted. This includes all your workspaces, bases, integrations, sources, and tokens listed.',
    onOk: async () => {
      try {
        await $api.user.delete()
        message.success('Account deleted. See you later!')
        await signOut({
          redirectToSignin: true,
          skipApiCall: true,
        })
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        loadingToBeDeleted.value = false
        clearTimeout(loadingToBeDeletedTimeout)
      }
    },
    onCancel: () => {
      loadingToBeDeleted.value = false
    },
  })
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
            <div class="flex h-20 mt-1.5">
              <GeneralUserIcon size="xlarge" :email="user?.email" :name="user?.display_name" />
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
        <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2">
          <div class="flex font-medium text-base" data-rec="true">Delete Account</div>
          <div class="flex text-gray-500" data-rec="true">Delete your account permanently (This action is irreversible)</div>
          <Transition>
            <div v-if="toBeDeleted" class="flex flex-col">
              <div class="flex flex-col gap-2">
                <template v-for="ent of entities" :key="ent.key">
                  <template v-if="toBeDeleted[ent.key].length">
                    <div class="rounded-lg border-1">
                      <div class="flex font-bold text-sm px-4 py-2 border-b-1 rounded-t-lg bg-gray-200" data-rec="true">
                        {{ ent.title }}
                      </div>
                      <div class="flex flex-col px-4 py-2">
                        <div v-for="entity in toBeDeleted[ent.key]" :key="entity.id">
                          {{ entity[ent.titleKey] }}
                        </div>
                      </div>
                    </div>
                  </template>
                </template>
              </div>
            </div>
          </Transition>
          <div class="flex flex-row mt-4">
            <NcButton
              v-if="toBeDeleted"
              type="danger"
              data-testid="nc-account-settings-delete"
              :loading="loadingToBeDeleted"
              @click="onDelete"
            >
              I understand the consequences, delete my account
            </NcButton>
            <NcButton
              v-else
              type="danger"
              data-testid="nc-account-settings-delete"
              :loading="loadingToBeDeleted"
              @click="onInitDelete"
            >
              Delete my account
            </NcButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
