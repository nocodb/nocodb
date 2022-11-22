<script lang="ts" setup>
import { Empty, Modal, message } from 'ant-design-vue'
import type { ApiTokenType, RequestParams, UserType } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useApi, useCopy, useNuxtApp } from '#imports'

const { api, isLoading } = useApi()

const { $e } = useNuxtApp()

const { copy } = useCopy()

const { t } = useI18n()

let tokens = $ref<UserType[]>([])

let currentPage = $ref(1)

let showNewTokenModal = $ref(false)

const currentLimit = $ref(10)

let selectedTokenData = $ref<ApiTokenType>({})

const searchText = ref<string>('')

const pagination = reactive({
  total: 0,
  pageSize: 10,
})
const loadTokens = async (page = currentPage, limit = currentLimit) => {
  currentPage = page
  try {
    const response: any = await api.orgTokens.list({
      query: {
        limit,
        offset: searchText.value.length === 0 ? (page - 1) * limit : 0,
      },
    } as RequestParams)
    if (!response) return

    pagination.total = response.pageInfo.totalRows ?? 0
    pagination.pageSize = 10

    tokens = response.list as UserType[]
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

loadTokens()

const deleteToken = async (token: string) => {
  Modal.confirm({
    title: t('msg.info.deleteTokenConfirmation'),
    type: 'warn',
    onOk: async () => {
      try {
        // todo: delete token
        await api.orgTokens.delete(token)
        message.success(t('msg.success.tokenDeleted'))
        await loadTokens()
      } catch (e) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
      $e('a:account:token:delete')
    },
  })
}

const generateToken = async () => {
  try {
    await api.orgTokens.create(selectedTokenData)
    showNewTokenModal = false
    // Token generated successfully
    message.success(t('msg.success.tokenGenerated'))
    selectedTokenData = {}
    await loadTokens()
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:api-token:generate')
}

const copyToken = (token: string | undefined) => {
  if (!token) return

  copy(token)
  // Copied to clipboard
  message.info(t('msg.info.copiedToClipboard'))

  $e('c:api-token:copy')
}

const descriptionInput = (el) => {
  el?.focus()
}
</script>

<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull pt-2">
    <div class="text-xl mt-4 mb-8 text-center font-weight-bold">Token Management</div>
    <div class="max-w-[900px] mx-auto p-4" data-testid="nc-token-list">
      <div class="py-2 flex gap-4 items-center">
        <div class="flex-grow"></div>
        <MdiReload class="cursor-pointer" @click="loadTokens" />
        <a-button data-testid="nc-token-create" size="small" type="primary" @click="showNewTokenModal = true">
          <div class="flex items-center gap-1">
            <MdiAdd />
            Add new token
          </div>
        </a-button>
      </div>
      <a-table
        :row-key="(record) => record.id"
        :data-source="tokens"
        :pagination="{ position: ['bottomCenter'] }"
        :loading="isLoading"
        size="small"
        @change="loadTokens($event.current)"
      >
        <template #emptyText>
          <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
        </template>

        <!-- Created By -->
        <a-table-column key="created_by" :title="$t('labels.createdBy')" data-index="created_by">
          <template #default="{ text }">
            <div v-if="text">
              {{ text }}
            </div>
            <div v-else class="text-gray-400">N/A</div>
          </template>
        </a-table-column>

        <!-- Description -->
        <a-table-column key="description" :title="$t('labels.description')" data-index="description">
          <template #default="{ text }">
            {{ text }}
          </template>
        </a-table-column>

        <!-- Token -->
        <a-table-column key="token" :title="$t('labels.token')" data-index="token">
          <template #default="{ text, record }">
            <div class="w-[320px]">
              <span v-if="record.show">{{ text }}</span>
              <span v-else>*******************************************</span>
            </div>
          </template>
        </a-table-column>

        <!-- Actions -->

        <a-table-column key="actions" :title="$t('labels.actions')" data-index="token">
          <template #default="{ record }">
            <div class="flex items-center gap-2">
              <a-tooltip placement="bottom">
                <template #title>
                  <span v-if="record.show"> {{ $t('general.hide') }} </span>
                  <span v-else> {{ $t('general.show') }} </span>
                </template>

                <a-button type="text" class="!rounded-md nc-toggle-token-visibility" @click="record.show = !record.show">
                  <template #icon>
                    <MaterialSymbolsVisibilityOff v-if="record.show" class="flex mx-auto h-[1.1rem]" />
                    <MaterialSymbolsVisibility v-else class="flex mx-auto h-[1rem]" />
                  </template>
                </a-button>
              </a-tooltip>

              <a-tooltip placement="bottom">
                <template #title> {{ $t('general.copy') }}</template>

                <a-button type="text" class="!rounded-md" @click="copyToken(record.token)">
                  <template #icon>
                    <MdiContentCopy class="flex mx-auto h-[1rem]" />
                  </template>
                </a-button>
              </a-tooltip>

              <a-dropdown
                :trigger="['click']"
                class="flex"
                placement="bottomRight"
                overlay-class-name="nc-dropdown-api-token-mgmt"
              >
                <div class="flex flex-row items-center">
                  <a-button type="text" class="!px-0">
                    <div class="flex flex-row items-center h-[1.2rem]">
                      <IcBaselineMoreVert class="nc-token-menu" />
                    </div>
                  </a-button>
                </div>

                <template #overlay>
                  <a-menu data-testid="nc-token-row-action-icon">
                    <a-menu-item>
                      <div class="flex flex-row items-center py-3 h-[1rem] nc-delete-token" @click="deleteToken(record.token)">
                        <MdiDeleteOutline class="flex" />
                        <div class="text-xs pl-2">{{ $t('general.remove') }}</div>
                      </div>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </template>
        </a-table-column>
      </a-table>
    </div>

    <a-modal
      v-model:visible="showNewTokenModal"
      :closable="false"
      width="28rem"
      centered
      :footer="null"
      wrap-class-name="nc-modal-generate-token"
    >
      <div class="relative flex flex-col h-full">
        <a-button type="text" class="!absolute top-0 right-0 rounded-md -mt-2 -mr-3" @click="showNewTokenModal = false">
          <template #icon>
            <MaterialSymbolsCloseRounded class="flex mx-auto" />
          </template>
        </a-button>

        <!-- Generate Token -->
        <div class="flex flex-row justify-center w-full -mt-1 mb-3">
          <a-typography-title :level="5">{{ $t('title.generateToken') }}</a-typography-title>
        </div>

        <!-- Description -->
        <a-form
          ref="form"
          :model="selectedTokenData"
          name="basic"
          layout="vertical"
          class="flex flex-col justify-center space-y-6"
          no-style
          autocomplete="off"
          @finish="generateToken"
        >
          <a-input
            :ref="descriptionInput"
            v-model:value="selectedTokenData.description"
            data-testid="nc-token-modal-description"
            :placeholder="$t('labels.description')"
          />

          <!-- Generate -->
          <div class="flex flex-row justify-center">
            <a-button type="primary" html-type="submit" data-testid="nc-token-modal-save">
              {{ $t('general.generate') }}
            </a-button>
          </div>
        </a-form>
      </div>
    </a-modal>
  </div>
</template>

<style scoped></style>
