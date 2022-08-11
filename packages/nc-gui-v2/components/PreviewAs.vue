<script lang="ts" setup>
import { onUnmounted } from '@vue/runtime-core'
import { useState } from '#app'
import { useEventListener, useGlobal, watch } from '#imports'
import MdiAccountStar from '~icons/mdi/account-star'
import MdiAccountHardHat from '~icons/mdi/account-hard-hat'
import MdiAccountEdit from '~icons/mdi/account-edit'
import MdiEyeOutline from '~icons/mdi/eye-outline'
import MdiCommentAccountOutline from '~icons/mdi/comment-account-outline'

const { float } = defineProps<{ float?: boolean }>()
const position = useState('preview-as-position', () => ({
  y: `${window.innerHeight - 100}px`,
  x: `${window.innerWidth / 2 - 250}px`,
}))

const roleList = [{ title: 'editor' }, { title: 'commenter' }, { title: 'viewer' }]

const { previewAs } = useGlobal()

const roleIcon = {
  owner: MdiAccountStar,
  creator: MdiAccountHardHat,
  editor: MdiAccountEdit,
  viewer: MdiEyeOutline,
  commenter: MdiCommentAccountOutline,
}

const divMove = (e: MouseEvent) => {
  position.value = { y: `${e.clientY - 10}px`, x: `${e.clientX - 18}px` }
}
const mouseUp = () => {
  window.removeEventListener('mousemove', divMove, true)
}

useEventListener(window, 'mouseup', mouseUp, false)

const mouseDown = () => {
  window.addEventListener('mousemove', divMove, true)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', divMove, true)
})

/** reload page on previewas change */
watch(previewAs, () => window.location.reload())
</script>

<template>
  <div v-if="float" class="floating-reset-btn nc-floating-preview-btn px-2" :style="{ top: position.y, left: position.x }">
    <MdiDrag style="cursor: move" class="text-white" @mousedown="mouseDown" />
    <div class="divider" />

    <div class="pointer flex items-center gap-2">
      <span>Preview as :</span>

      <a-radio-group v-model:value="previewAs" name="radioGroup">
        <a-radio v-for="role in roleList" :key="role.title" class="!text-xs !text-white" :value="role.title"
          >{{ role.title }}
        </a-radio>
      </a-radio-group>

      <div class="divider" />

      <div class="flex items-center gap-2 cursor-pointer" @click="previewAs = null">
        <MdiExitToApp />
        Exit
      </div>
    </div>
  </div>

  <template v-else>
    <template v-for="role of roleList" :key="role.title">
      <a-menu-item :class="`pointer nc-preview-${role.title}`" @click="previewAs = role.title">
        <div class="p-1 flex gap-2 items-center">
          <component :is="roleIcon[role.title]" />

          <span class="text-capitalize text-xs" :class="{ 'x-active--text': role.title === previewAs }">{{ role.title }}</span>
        </div>
      </a-menu-item>
    </template>

    <template v-if="previewAs">
      <a-menu-item @click="previewAs = null">
        <div class="p-1 flex gap-2 items-center">
          <mdi-close />
          <!-- Reset Preview -->
          <span class="text-capitalize text-xs whitespace-nowrap">{{ $t('activity.resetReview') }}</span>
        </div>
      </a-menu-item>
    </template>
  </template>
</template>

<style scoped>
.floating-reset-btn {
  @apply bg-primary/80 z-1000 index-100 fixed text-white py-1 pr-3 text-xs font-weight-bold
  @apply flex items-center overflow-hidden whitespace-nowrap gap-2 rounded shadow-md;
}

:deep(.ant-radio) {
  @apply transform scale-80;
}

.divider {
  @apply h-5 w-2px bg-white/50;
}
</style>
