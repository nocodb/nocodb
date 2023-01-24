<script lang="ts" setup>
import { LoadingOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import type { BookType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const isOpen = useVModel(props, 'modelValue', emits)

const { books, bookUrl, fetchBooks, createBook } = useDocs()

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '24px',
  },
  spin: true,
})

const formStatus = ref<'notSubmited' | 'submitting' | 'submitted'>('notSubmited')
const bookFormData = ref<{ title: string }>({
  title: '',
})
const showVersions = ref(false)
const createdBook = ref<BookType | undefined>()

const navigateToBook = (book: BookType) => navigateTo(bookUrl(book.slug!))

const createNewVersion = async () => {
  formStatus.value = 'submitting'
  try {
    const book = await createBook({
      book: {
        title: bookFormData.value.title!,
      },
      navigate: false,
    })
    createdBook.value = book
    formStatus.value = 'submitted'
  } catch (e) {
    console.error(e)
    formStatus.value = 'notSubmited'
    message.error(await extractSdkResponseErrorMsg(e as any))
  }
}

watch(formStatus, async () => {
  if (formStatus.value === 'submitted') {
    await Promise.all([new Promise((resolve) => setTimeout(resolve, 300)), fetchBooks()])
    const book = books.value.find((b) => b.id === createdBook.value!.id!)

    isOpen.value = false
    await navigateToBook(book!)
  }
})
</script>

<template>
  <a-modal
    :visible="isOpen"
    :closable="false"
    ok-text="Publish"
    class="docs-version-modal"
    :ok-button-props="{ hidden: true }"
    :cancel-button-props="{ hidden: true }"
    :footer="null"
    :centered="true"
  >
    <div v-if="isOpen" class="flex flex-col">
      <div class="flex flex-row justify-between items-center mr-4 ml-3">
        <div class="flex text-md py-1 pl-2" style="font-weight: 500">
          <div v-if="formStatus === 'submitted'">
            <span class="text-primary">
              {{ bookFormData?.title }}
            </span>
            <span> has been created </span>
          </div>
          <template v-else-if="formStatus === 'submitting'"> Creating new version... </template>
          <template v-else> Create new version </template>
        </div>
        <div
          v-if="formStatus === 'notSubmited'"
          class="flex hover:bg-gray-50 p-1 rounded-md cursor-pointer"
          @click="isOpen = false"
        >
          <MdiClose class="h-3.5" />
        </div>
        <div v-if="formStatus === 'submitting'">
          <a-spin :indicator="indicator" />
        </div>
        <div v-if="formStatus === 'submitted'" class="flex hover:bg-gray-50 p-1 rounded-md cursor-pointer">
          <MdiCheck class="my-auto" />
        </div>
      </div>
    </div>
    <div v-if="formStatus === 'notSubmited'" class="flex flex-col mx-4 pt-3 border-t-1 border-gray-200">
      <a-input v-model:value="bookFormData.title" class="flex w-full !rounded-md !bg-gray-50" placeholder="Version title" />
      <div class="flex flex-row justify-between mt-3.5 mb-2">
        <div
          class="flex flex-row text-xs items-center p-2 gap-x-1 cursor-pointer rounded-md hover:bg-gray-50"
          @click="showVersions = !showVersions"
        >
          <template v-if="!showVersions">
            <div class="flex">View all versions</div>
            <MdiMenuDown class="my-auto h-3.5" />
          </template>
          <template v-else>
            <div class="flex">Hide all versions</div>
            <MdiMenuUp class="my-auto h-3.5" />
          </template>
        </div>
        <a-button :disabled="bookFormData.title?.length === 0" type="primary" class="flex !rounded-md" @click="createNewVersion">
          Create version
        </a-button>
      </div>
      <div v-if="showVersions" class="flex flex-col mt-2 pt-3 border-gray-200 border-t-1 max-h-30">
        <div
          v-for="book of books"
          :key="book.id"
          class="flex flex-row justify-between items-center p-2 bg-gray-100 rounded-md border-gray-200 border-1 cursor-pointer hover:bg-gray-200"
          @click="() => navigateToBook(book)"
        >
          <div class="flex flex-row gap-x-2 text-xs">
            <div class="flex">{{ book.title }}</div>
            <div
              v-if="book.is_published"
              class="flex border-1 rounded-md px-0.5 items-center border-green-500 text-green-600 bg-green-50"
              :style="{ fontSize: '0.6rem' }"
            >
              <div class="flex">Published</div>
            </div>
          </div>
          <div class="flex text-xs text-gray-500">
            {{ book.is_published ? dayjs(book.last_published_date).local().fromNow() : dayjs(book.created_at).local().fromNow() }}
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss">
.docs-version-modal {
  .doc-publish-draft-list {
    &::-webkit-scrollbar {
      width: 4px;
    }

    /* Track */
    &::-webkit-scrollbar-track {
      background: #ffffff00 !important;
    }

    /* Handle */
    &::-webkit-scrollbar-thumb {
      background: rgb(228, 228, 228);
    }

    /* Handle on hover */
    &::-webkit-scrollbar-thumb:hover {
      background: rgb(194, 194, 194);
    }
  }
  .ant-modal-content {
    @apply !rounded-md;
  }
  .ant-modal-body {
    @apply !py-2.5 !px-0;
  }
}
</style>
