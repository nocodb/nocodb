<script lang="ts" setup>
import type { ApiTokenType, BaseType, IntegrationType, SourceType, WorkspaceType } from 'nocodb-sdk'

const { user, signOut } = useGlobal()

const { $api } = useNuxtApp()

const deleteAccountRef = ref<HTMLDivElement>()

const deleteAcInputRef = ref<HTMLInputElement>()

const toBeDeleted = ref<
  {
    workspaces: WorkspaceType[]
    bases: BaseType & { base_role: string; workspace_title: string }[]
    integrations: IntegrationType[]
    sources: SourceType[]
    apiTokens: ApiTokenType[]
    access: {
      workspaces: WorkspaceType[]
      bases: BaseType & { base_role: string; workspace_title: string }[]
    }
    isAccepted?: boolean
  } & any
>()

const entitiesToRemove = [
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

const entitiesToRemoveAccess = [
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
]

const loadingToBeDeleted = ref(false)

const isDeleteModalVisible = ref(false)

const toBeDeletedUserEmail = ref('')

let loadingToBeDeletedTimeout: unknown

const onDelete = async () => {
  if (loadingToBeDeleted.value) return

  isDeleteModalVisible.value = true

  setTimeout(() => {
    deleteAcInputRef.value?.focus()
  }, 250)
}

const onInitDelete = async () => {
  if (loadingToBeDeleted.value) return

  loadingToBeDeleted.value = true

  try {
    const res = (await $api.user.delete({
      dry: true,
    })) as any

    toBeDeleted.value = res

    loadingToBeDeletedTimeout = setTimeout(() => {
      isDeleteModalVisible.value = false
      toBeDeleted.value = undefined
    }, 10 * 60 * 1000)

    nextTick(() => {
      deleteAccountRef.value?.scrollIntoView({ behavior: 'smooth' })
    })

    loadingToBeDeleted.value = false

    onDelete()
  } catch (e: any) {
    console.error(e)
  } finally {
    loadingToBeDeleted.value = false
  }
}

const onDeleteConfirm = async () => {
  if (loadingToBeDeleted.value) return

  if (toBeDeletedUserEmail.value !== user.value?.email) {
    message.error('Email does not match')
    return
  }

  loadingToBeDeleted.value = true

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
  }
}
</script>

<template>
  <div ref="deleteAccountRef" class="mt-10 flex flex-col border-1 rounded-2xl border-red-500 p-6">
    <div class="text-base font-bold text-nc-content-red-dark" data-rec="true">Danger Zone</div>
    <div class="text-sm text-nc-content-gray-muted mt-2" data-rec="true">Delete your account permanently</div>

    <div class="flex p-4 border-1 rounded-lg mt-6 items-center" data-rec="true">
      <component :is="iconMap.alertTriangleSolid" class="text-nc-content-orange-medium h-6 w-6 flex-none" />
      <div class="text-base font-bold ml-3">This action is irreversible</div>
    </div>
    <div class="mt-5">
      Deleting your account will permanently remove any Workspaces and Bases where you are the sole owner. For all other cases,
      your access permissions will be revoked.
    </div>

    <div class="flex flex-row gap-x-2 w-full justify-end mt-8">
      <NcButton
        type="danger"
        data-testid="nc-account-settings-delete"
        :loading="loadingToBeDeleted"
        size="small"
        @click="onInitDelete"
      >
        Delete Account
      </NcButton>
    </div>
    <GeneralModal v-model:visible="isDeleteModalVisible" class="nc-user-delete-modal" size="small" centered>
      <div class="flex flex-col gap-2 justify-center h-full !p-6">
        <div class="text-lg font-semibold self-start mb-3 sticky top-0 bg-white">Delete Account</div>

        <div v-if="toBeDeleted" class="flex flex-col">
          <div class="flex flex-col gap-2">
            <template v-for="ent of entitiesToRemove" :key="ent.key">
              <template v-if="toBeDeleted[ent.key].length">
                <span>
                  The following <b>{{ ent.title.toLocaleLowerCase() }}</b> will be automatically deleted:
                </span>
                <div class="rounded-lg border-1 max-h-[144px] nc-scrollbar-thin">
                  <div class="flex flex-col">
                    <div
                      v-for="entity in toBeDeleted[ent.key]"
                      :key="entity.id"
                      class="px-4 py-2 border-b-1 bg-gray-50 first:rounded-t-lg last:rounded-b-lg last:border-b-0"
                    >
                      <AccountDeleteCard :entity="entity" :entity-def="ent" />
                    </div>
                  </div>
                </div>
              </template>
            </template>
            <template v-for="ent of entitiesToRemoveAccess" :key="ent.key">
              <template v-if="toBeDeleted.access[ent.key].length">
                <span>
                  You will lose your access to following <b>{{ ent.title.toLocaleLowerCase() }}</b
                  >:
                </span>
                <div class="rounded-lg border-1 max-h-[144px] nc-scrollbar-thin">
                  <div class="flex flex-col">
                    <div
                      v-for="entity in toBeDeleted.access[ent.key]"
                      :key="entity.id"
                      class="px-4 py-2 border-b-1 bg-gray-50 first:rounded-t-lg last:rounded-b-lg border-b-1 last:border-b-0"
                    >
                      <AccountDeleteCard :entity="entity" :entity-def="ent" />
                    </div>
                  </div>
                </div>
              </template>
            </template>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="self-start mb-2 mt-3">
            Enter your email to delete your account <span class="text-red-500">permanently</span>&nbsp;<b class="select-none">
              ‘{{ user?.email }}’
            </b>
          </span>

          <a-input
            ref="deleteAcInputRef"
            v-model:value="toBeDeletedUserEmail"
            class="w-full nc-input-sm nc-input-shadow"
            :placeholder="$t('labels.email')"
            autocomplete="off"
            data-testid="nc-account-settings-email-input"
          />
          <div class="w-full flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
            <NcButton
              html-type="back"
              type="secondary"
              size="small"
              @click="
                () => {
                  isDeleteModalVisible = false
                  toBeDeleted = false
                }
              "
            >
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton
              html-type="submit"
              type="danger"
              size="small"
              :disabled="loadingToBeDeleted || toBeDeletedUserEmail !== user?.email"
              :loading="loadingToBeDeleted"
              data-testid="nc-account-settings-delete-confirm"
              @click="onDeleteConfirm"
            >
              Delete Account
            </NcButton>
          </div>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>

<style></style>
