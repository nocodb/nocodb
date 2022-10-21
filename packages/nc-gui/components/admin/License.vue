<script lang="ts" setup>
import { message } from 'ant-design-vue'
import type { RequestParams, UserType } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useApi, useCopy } from '#imports'

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

</script>

<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull pt-4">
    <div class="text-xl mt-4">License</div>
    <a-divider class="!my-3" />
    <a-textarea placeholder="License key" class="!mt-4 max-w-[300px]"></a-textarea>
    <a-button class="mt-4 float-right" type="primary">Save license key</a-button>
  </div>
</template>

<style scoped></style>
