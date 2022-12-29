<script lang="ts" setup>
import { BubbleMenu, EditorContent, FloatingMenu, useEditor } from '@tiptap/vue-3'
import BulletList from '@tiptap/extension-bullet-list'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import Strike from '@tiptap/extension-strike'
import Heading from '@tiptap/extension-heading'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Commands from './commands'
import suggestion from './suggestion'

const { openedPage, openedBook, updatePage, openedNestedPagesOfBook, nestedUrl, bookUrl } = useDocs()

const isTitleInputRefLoaded = ref(false)
const titleInputRef = ref<HTMLInputElement>()

const content = computed(() => openedPage.value?.content || '')

const breadCrumbs = computed(() => {
  const bookBreadcrumb = {
    title: openedBook.value!.title,
    href: bookUrl(openedBook.value!.slug!),
  }
  const pagesBreadcrumbs = openedNestedPagesOfBook.value.map((page) => ({
    title: page.title,
    href: nestedUrl(page.slug!),
  }))
  return [bookBreadcrumb, ...pagesBreadcrumbs]
})

const editor = useEditor({
  extensions: [
    StarterKit,
    Strike,
    Heading,
    Commands.configure({
      suggestion,
    }),
    Placeholder.configure({
      placeholder: 'Press / to open the command menu or start writing',
    }),
    BulletList,
    TaskList.configure({
      HTMLAttributes: {
        class: 'nc-docs-task-list',
      },
    }),
    TaskItem.configure({
      nested: true,
    }),
    HorizontalRule.configure({
      HTMLAttributes: {
        class: 'nc-docs-horizontal-rule',
      },
    }),
    Image.configure({
      inline: true,
    }),
  ],
  onUpdate: ({ editor }) => {
    if (!openedPage.value) return

    openedPage.value.content = editor.getHTML()
  },
})

watch(
  () => content.value,
  () => {
    if (content.value !== editor.value?.getHTML()) {
      editor.value?.commands.setContent(content.value)
    }
  },
)

watch(editor, () => {
  editor.value?.commands.setContent(content.value)
})

watchDebounced(
  () => [openedPage.value?.id, openedPage.value?.title],
  async ([newId, newTitle], [oldId, oldTitle]) => {
    if (newId === oldId && newTitle && newTitle.length > 0 && newTitle !== oldTitle) {
      await updatePage({ pageId: newId!, page: { title: newTitle } as any })
    }
  },
  {
    debounce: 100,
    maxWait: 300,
  },
)

// todo: Hack to focus on title when its edited since on edit route is changed
watch(titleInputRef, (el) => {
  if (!isTitleInputRefLoaded.value && !openedPage.value?.new) {
    isTitleInputRefLoaded.value = true
    return
  }

  isTitleInputRefLoaded.value = true
  el?.focus()
})

watchDebounced(
  content,
  () => openedPage.value?.id && updatePage({ pageId: openedPage.value?.id, page: { content: openedPage.value!.content } as any }),
  {
    debounce: 300,
    maxWait: 600,
  },
)
</script>

<template>
  <a-layout-content>
    <div v-if="openedPage" class="mx-20 px-6 mt-16 flex flex-col gap-y-4">
      <div class="flex flex-row justify-between">
        <a-breadcrumb v-if="breadCrumbs.length >= 0" class="!px-2">
          <a-breadcrumb-item v-for="({ href, title }, index) of breadCrumbs" :key="href">
            <NuxtLink
              class="!text-gray-400 !hover:text-black docs-breadcrumb-item"
              :to="href"
              :class="{
                '!text-black !underline-current': index === breadCrumbs.length - 1,
                '!underline-transparent !hover:underline-transparent': index !== breadCrumbs.length - 1,
              }"
            >
              {{ title }}
            </NuxtLink>
          </a-breadcrumb-item>
        </a-breadcrumb>
        <div v-else class="flex"></div>
        <div class="flex flex-row">
          <div
            class="hover:cursor-pointer hover:bg-gray-50 flex flex-col justify-center !px-1 !py-1 rounded-md !text-gray-400 !hover:text-gray-600"
          >
            <MdiShareVariant />
          </div>
        </div>
      </div>

      <a-textarea
        ref="titleInputRef"
        v-model:value="openedPage.title"
        class="!text-4xl font-semibold !px-1.5"
        :bordered="false"
        placeholder="Type to add title"
        auto-size
      />

      <BubbleMenu v-if="editor" :editor="editor" :tippy-options="{ duration: 100 }">
        <div class="flex flex-row gap-x-1 mb-1">
          <button
            :class="{ 'is-active': editor.isActive('bold') }"
            class="px-1 border-black border bg-white"
            @click="editor!.chain().focus().toggleBold().run()"
          >
            bold
          </button>
          <button
            :class="{ 'is-active': editor.isActive('italic') }"
            class="px-1 border-black border bg-white"
            @click="editor!.chain().focus().toggleItalic().run()"
          >
            italic
          </button>
          <button
            :class="{ 'is-active': editor.isActive('strike') }"
            class="px-1 border-black border bg-white"
            @click="editor!.chain().focus().toggleStrike().run()"
          >
            strike
          </button>
          <button
            :class="{ 'is-active': editor.isActive('strike') }"
            class="px-1 border-black border bg-white"
            @click="editor!.chain().focus().toggleBulletList().run()"
          >
            bullet
          </button>
        </div>
      </BubbleMenu>
      <FloatingMenu v-if="editor" :editor="editor" :tippy-options="{ duration: 100, placement: 'left' }">
        <MdiPlus
          class="hover:cursor-pointer hover:bg-gray-100 rounded-md mt-1.5"
          @click="editor!.chain().focus().insertContent('/').run()"
        />
      </FloatingMenu>
      <EditorContent :editor="editor" class="px-2" />
    </div>
  </a-layout-content>
</template>

<style lang="scss">
/* Basic editor styles */
.ProseMirror {
  > * + * {
    margin-top: 0.75em;
  }
}

.ProseMirror p.is-empty::before {
  content: attr(data-placeholder);
  float: left;
  color: #bcc2c8;
  pointer-events: none;
  height: 0;
}

.ProseMirror .nc-docs-list-item > p {
  margin-top: 0.25rem !important;
  margin-bottom: 0.25rem !important;
}

.ProseMirror-focused {
  // remove all border
  outline: none;
}
.ProseMirror p {
  margin-top: 1em;
  margin-bottom: 1em;
}
.ProseMirror h1 {
  font-size: 3rem;
}
.ProseMirror h2 {
  font-size: 2rem;
}
.ProseMirror h3 {
  font-size: 1.25rem;
}
.ProseMirror h4 {
  font-size: 2rem;
}
.ProseMirror h5 {
  font-size: 1.5rem;
}
.ProseMirror h6 {
  font-size: 1rem;
}

ul[data-type='taskList'] {
  list-style: none;
  padding: 0;

  p {
    margin: 0;
  }

  li {
    display: flex;

    > label {
      margin-right: 0.5rem;
      user-select: none;
    }

    > label > input {
      // margin-top: 0.1rem !important;
      margin-bottom: 0.2rem !important;
      // height: max-content;
    }

    > div {
      flex: 1 1 auto;
    }
  }
}

hr.nc-docs-horizontal-rule {
  border: 0;
  border-top: 1px solid #ccc;
  margin: 1.5em 0;
}
</style>
