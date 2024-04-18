<script setup lang="ts">
interface Prop {
  extensionId: string
  error?: any
}

const { extensionId, error } = defineProps<Prop>()

const { extensionList, availableExtensions, getExtensionIcon, duplicateExtension } = useExtensions()

const activeError = ref(error)

const extension = computed(() => {
  const ext = extensionList.value.find((ext) => ext.id === extensionId)
  if (!ext) {
    throw new Error('Extension not found')
  }
  return ext
})

const titleInput = ref<HTMLInputElement | null>(null)

const titleEditMode = ref<boolean>(false)

const tempTitle = ref<string>(extension.value.title)

const enableEditMode = () => {
  titleEditMode.value = true
  tempTitle.value = extension.value.title
  nextTick(() => {
    titleInput.value?.focus()
    titleInput.value?.select()
    titleInput.value?.scrollIntoView()
  })
}

const updateExtensionTitle = async () => {
  await extension.value.setTitle(tempTitle.value)
  titleEditMode.value = false
}

const { fullscreen, collapsed } = useProvideExtensionHelper(extension)

const component = ref<any>(null)

const extensionManifest = ref<any>(null)

onMounted(() => {
  until(() => availableExtensions.value.length)
    .toMatch((v) => v > 0)
    .then(() => {
      extensionManifest.value = availableExtensions.value.find((ext) => ext.id === extension.value.extensionId)

      if (!extensionManifest) {
        return
      }

      import(`../../extensions/${extensionManifest.value.entry}/index.vue`).then((mod) => {
        component.value = markRaw(mod.default)
      })
    })
    .catch((err) => {
      if (!extensionManifest.value) {
        activeError.value = 'There was an error loading the extension'
        return
      }
      activeError.value = err
    })
})
</script>

<template>
  <div class="w-full p-2">
    <div class="extension-wrapper">
      <div class="extension-header">
        <div class="extension-header-left">
          <GeneralIcon icon="drag" />
          <img v-if="extensionManifest" :src="getExtensionIcon(extensionManifest.iconUrl)" alt="icon" class="w-6 h-6" />
          <input
            v-if="titleEditMode"
            ref="titleInput"
            v-model="tempTitle"
            class="flex-grow leading-1 outline-0 ring-none capitalize !text-inherit !bg-transparent w-4/5"
            @click.stop
            @keyup.enter="updateExtensionTitle"
            @keyup.esc="updateExtensionTitle"
            @blur="updateExtensionTitle"
          />
          <div v-else class="extension-title" @dblclick="enableEditMode">{{ extension.title }}</div>
        </div>
        <div class="extension-header-right">
          <GeneralIcon v-if="!activeError" icon="expand" @click="fullscreen = true" />
          <NcDropdown :trigger="['click']">
            <GeneralIcon icon="threeDotVertical" />

            <template #overlay>
              <NcMenu>
                <template v-if="!activeError">
                  <NcMenuItem data-rec="true" class="!hover:text-primary" @click="enableEditMode">
                    <GeneralIcon icon="edit" />
                    Rename
                  </NcMenuItem>
                  <NcMenuItem data-rec="true" class="!hover:text-primary" @click="duplicateExtension(extension.id)">
                    <GeneralIcon icon="duplicate" />
                    Duplicate
                  </NcMenuItem>
                  <NcMenuItem data-rec="true" class="!hover:text-primary">
                    <GeneralIcon icon="info" />
                    Details
                  </NcMenuItem>
                  <NcDivider />
                </template>
                <NcMenuItem data-rec="true" class="!text-red-500 !hover:bg-red-50" @click="extension.delete()">
                  <GeneralIcon icon="delete" />
                  Delete
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
          <GeneralIcon v-if="collapsed" icon="arrowUp" @click="collapsed = !collapsed" />
          <GeneralIcon v-else icon="arrowDown" @click="collapsed = !collapsed" />
        </div>
      </div>
      <template v-if="activeError">
        <div v-show="!collapsed" class="extension-content">
          <a-result status="error" title="Extension Error">
            <template #subTitle>{{ activeError }}</template>
            <template #extra>
              <NcButton @click="extension.clear()">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="reload" />
                  Clear Data
                </div>
              </NcButton>
              <NcButton type="danger" @click="extension.delete()">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="delete" />
                  Delete
                </div>
              </NcButton>
            </template>
          </a-result>
        </div>
      </template>
      <template v-else>
        <div v-if="!fullscreen" v-show="!collapsed" class="extension-content"><component :is="component" /></div>
        <NcModal
          v-else
          v-model:visible="fullscreen"
          class="extension-fullscreen"
          :body-style="{ 'max-height': '85vh', 'height': '85vh' }"
          :closable="false"
          :footer="null"
          width="90vw"
        >
          <div class="flex items-center justify-between p-2 bg-gray-100 rounded-t-lg cursor-default">
            <div class="flex items-center gap-2 text-gray-500 font-weight-600">
              <img v-if="extensionManifest" :src="getExtensionIcon(extensionManifest.iconUrl)" alt="icon" class="w-6 h-6" />
              <div class="text-sm">{{ extension.title }}</div>
            </div>
            <GeneralIcon class="cursor-pointer" icon="close" @click="fullscreen = false" />
          </div>
          <div class="w-full h-full p-2"><component :is="component" /></div>
        </NcModal>
      </template>
    </div>
  </div>
</template>

<style lang="scss">
.extension-wrapper {
  @apply bg-white rounded-lg p-2 w-full border-1;
}

.extension-header {
  @apply flex justify-between;

  .extension-header-left {
    @apply flex items-center gap-2;
  }

  .extension-header-right {
    @apply flex items-center gap-4;
  }

  .extension-title {
    @apply font-weight-600;
  }
}

.extension-content {
  @apply border-1 m-2 p-2 rounded-lg;
}

.extension-fullscreen .nc-modal {
  @apply p-0;
}
</style>
