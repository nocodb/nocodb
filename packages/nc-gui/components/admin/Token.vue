<script lang="ts" setup>
import { message, Empty, Modal } from 'ant-design-vue'

import type { RequestParams, UserType } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useApi , useCopy} from '#imports'

const { api, isLoading } = useApi()


const { copy } = useCopy()

let tokens = $ref<UserType[]>([])

let currentPage = $ref(1)

const currentLimit = $ref(10)

const showUserModal = ref(false)

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
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

loadTokens()

const deleteToken = async (userId: string) => {
  Modal.confirm({
    title: 'Are you sure you want to delete this token?',
    type: 'warn',
       onOk: async () => {
      try {
        // todo: delete token
        // await api.orgUsers.delete(userId)
        // message.success('User deleted successfully')
        // await loadUsers()
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

</script>

<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull">
    <div class="text-xl mt-4">Token Management</div>
    <a-divider class="!my-3" />
    <div class="max-w-[700px] mx-auto p-4">
      <div class="py-2 flex">
        <div class="flex-grow"></div>
        <a-button size="small" @click="showUserModal = true">
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
        @change="loadTokens($event.current)"
        size="small"
      >
        <template #emptyText>
          <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
        </template>


        <!-- Token -->
        <a-table-column key="createdBy" :title="$t('labels.createdBy')" data-index="createdBy">
          <template #default="{ text }">
            <div>
              {{ text ?? 'N/A' }}
            </div>
          </template>
        </a-table-column>





        <!-- Token -->
        <a-table-column key="token" :title="$t('labels.token')" data-index="token">
          <template #default="{ text, record }">
            <div>
              <span v-if="record.show">{{ text }}</span>
              <span v-else>****************************************</span>
            </div>
          </template>
        </a-table-column>




        <!-- Actions -->

        <a-table-column key="id" :title="$t('labels.actions')" data-index="id">
          <template #default="{ record }">
            <div class="flex items-center gap-2">
              <a-tooltip placement="bottom">
                <template #title>
                  <span v-if="record.show"> {{ $t('general.hide') }} </span>
                  <span v-else> {{ $t('general.show') }} </span>
                </template>

                <a-button type="text" class="!rounded-md" @click="record.show = !record.show">
                  <template #icon>
                    <MaterialSymbolsVisibilityOff v-if="record.show" class="flex mx-auto h-[1.1rem]" />
                    <MaterialSymbolsVisibility v-else class="flex mx-auto h-[1rem]" />
                  </template>
                </a-button>
              </a-tooltip>

              <a-tooltip placement="bottom">
                <template #title> {{ $t('general.copy') }} </template>

                <a-button type="text" class="!rounded-md" @click="copy(record.token)">
                  <template #icon>
                    <MdiContentCopy class="flex mx-auto h-[1rem]" />
                  </template>
                </a-button>
              </a-tooltip>

              <a-dropdown :trigger="['click']" class="flex" placement="bottomRight" overlay-class-name="nc-dropdown-api-token-mgmt">
                <div class="flex flex-row items-center">
                  <a-button type="text" class="!px-0">
                    <div class="flex flex-row items-center h-[1.2rem]">
                      <IcBaselineMoreVert />
                    </div>
                  </a-button>
                </div>

                <template #overlay>
                  <a-menu>
                    <a-menu-item>
                      <div class="flex flex-row items-center py-3 h-[1rem]" @click="deleteToken(record)">
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
          <a-input v-model:value="selectedTokenData.description" :placeholder="$t('labels.description')" />

          <!-- Generate -->
          <div class="flex flex-row justify-center">
            <a-button type="primary" html-type="submit">
              {{ $t('general.generate') }}
            </a-button>
          </div>
        </a-form>
      </div>
    </a-modal>
  </div>
</template>

<style scoped></style>
