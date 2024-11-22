<script lang="ts" setup>
import type { ApiTokenType, BaseType, IntegrationType, SourceType, WorkspaceType } from 'nocodb-sdk'

const { user, signOut } = useGlobal()

const { $api } = useNuxtApp()

const toBeDeleted = ref<
  {
    workspaces: WorkspaceType[]
    bases: BaseType[]
    integrations: IntegrationType[]
    sources: SourceType[]
    apiTokens: ApiTokenType[]
    access: {
      workspaces: WorkspaceType[]
      bases: BaseType[]
    }
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

  isDeleteModalVisible.value = true
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
  <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2">
    <div class="flex font-medium text-base" data-rec="true">Delete Account</div>
    <div class="flex text-gray-500" data-rec="true">Delete your account permanently (This action is irreversible)</div>
    <Transition>
      <div v-if="toBeDeleted" class="flex flex-col">
        <div class="flex flex-col gap-2">
          <p v-if="Object.values(toBeDeleted).every((el) => !(el as any)?.length)" class="text-gray-500 p-2">
            <GeneralIcon icon="info" class="text-primary" />
            No entities found where you are the sole owner. Deleting your account will not affect any entities.
          </p>
          <template v-for="ent of entitiesToRemove" :key="ent.key">
            <template v-if="toBeDeleted[ent.key].length">
              <span>
                The following <b>{{ ent.title.toLocaleLowerCase() }}</b> will be automatically deleted:
              </span>
              <div class="rounded-lg border-1">
                <div class="flex flex-col">
                  <div
                    v-for="entity in toBeDeleted[ent.key]"
                    :key="entity.id"
                    class="px-4 py-2 border-b-1 bg-gray-50 first:rounded-t-lg last:rounded-b-lg last:border-b-0"
                  >
                    <div class="flex items-center gap-2">
                      <div class="icon">
                        <GeneralWorkspaceIcon v-if="ent.key === 'workspaces'" :workspace="entity" size="medium" />
                        <GeneralProjectIcon v-else-if="ent.key === 'bases'" :color="parseProp(entity.meta).iconColor" />
                        <GeneralBaseLogo v-else-if="ent.key === 'sources'" />
                        <GeneralIcon v-else-if="ent.key === 'apiTokens'" class="text-yellow-500 mt-1" icon="key" />
                      </div>
                      <div class="flex flex-col">
                        <div class="font-semibold">{{ entity[ent.titleKey] }}</div>
                      </div>
                    </div>
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
              <div class="rounded-lg border-1">
                <div class="flex flex-col">
                  <div
                    v-for="entity in toBeDeleted.access[ent.key]"
                    :key="entity.id"
                    class="px-4 py-2 border-b-1 bg-gray-50 first:rounded-t-lg last:rounded-b-lg border-b-1 last:border-b-0"
                  >
                    <div class="flex items-center gap-2">
                      <div class="icon">
                        <GeneralWorkspaceIcon v-if="ent.key === 'workspaces'" :workspace="entity" size="medium" />
                        <GeneralProjectIcon v-else-if="ent.key === 'bases'" :color="parseProp(entity.meta).iconColor" />
                      </div>
                      <div class="flex flex-col">
                        <div class="font-semibold">{{ entity[ent.titleKey] }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>
    </Transition>
    <div class="flex flex-row w-full justify-end">
      <NcButton
        v-if="toBeDeleted"
        type="danger"
        data-testid="nc-account-settings-delete"
        :loading="loadingToBeDeleted"
        @click="onDelete"
      >
        I understand the consequences, delete my account
      </NcButton>
      <NcButton v-else type="danger" data-testid="nc-account-settings-delete" :loading="loadingToBeDeleted" @click="onInitDelete">
        Delete my account
      </NcButton>
    </div>
    <GeneralModal v-model:visible="isDeleteModalVisible" class="nc-user-delete-modal" size="small" centered>
      <div class="flex flex-col gap-2 items-center justify-center h-full !p-6">
        <div class="flex flex-row justify-between w-full">
          <div class="flex flex-row items-center gap-2">
            <GeneralIcon icon="warning" class="text-red-500 text-xl" />
            <div class="text-lg font-bold self-start">Delete Account</div>
          </div>
          <GeneralIcon icon="close" class="cursor-pointer" @click="isDeleteModalVisible = false" />
        </div>
        <span class="self-start mb-2">
          Enter your email to delete your account <span class="text-red-500">permanently</span>&nbsp;<b class="select-none">
            ‘{{ user?.email }}’
          </b>
        </span>
        <a-input
          v-model:value="toBeDeletedUserEmail"
          class="w-full !rounded-md !py-1.5"
          :placeholder="$t('labels.email')"
          data-testid="nc-account-settings-email-input"
        />
        <div class="flex flex-row w-full justify-end mt-4">
          <NcButton
            type="danger"
            html-type="submit"
            :disabled="loadingToBeDeleted"
            :loading="loadingToBeDeleted"
            data-testid="nc-account-settings-delete-confirm"
            @click="onDeleteConfirm"
          >
            <template #loading> {{ $t('general.deleting') }} </template>
            {{ $t('general.confirm') }}
          </NcButton>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>

<style></style>
