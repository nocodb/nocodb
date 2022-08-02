<script setup lang="ts">
import { inject } from '#imports'
import { ColumnInj, IsFormInj } from '~/context'
import MdiCheckBold from '~icons/mdi/check-bold'
import MdiCropSquare from '~icons/mdi/crop-square'
import MdiCheckCircleOutline from '~icons/mdi/check-circle-outline'
import MdiCheckboxBlankCircleOutline from '~icons/mdi/checkbox-blank-circle-outline'
import MdiStar from '~icons/mdi/star'
import MdiStarOutline from '~icons/mdi/star-outline'
import MdiHeart from '~icons/mdi/heart'
import MdiHeartOutline from '~icons/mdi/heart-outline'
import MdiMoonFull from '~icons/mdi/moon-full'
import MdiMoonNew from '~icons/mdi/moon-new'
import MdiThumbUp from '~icons/mdi/thumb-up'
import MdiThumbUpOutline from '~icons/mdi/thumb-up-outline'
import MdiFlag from '~icons/mdi/flag'
import MdiFlagOutline from '~icons/mdi/flag-outline'

interface Props {
  modelValue?: boolean | undefined | number
}

interface Emits {
  (event: 'update:modelValue', model: boolean | undefined | number): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()
const vModel = $(useVModel(props, 'modelValue', emits))

const column = inject(ColumnInj)
const isForm = inject(IsFormInj)

const checkboxMeta = $computed(() => {
  return {
    icon: {
      checked: 'mdi-check-circle-outline',
      unchecked: 'mdi-checkbox-blank-circle-outline',
    },
    color: 'primary',
    ...(column?.meta || {}),
  }
})

const icon = (type: string) => {
  switch (type) {
    case 'mdi-check-bold':
      return MdiCheckBold
    case 'mdi-crop-square':
      return MdiCropSquare
    case 'mdi-check-circle-outline':
      return MdiCheckCircleOutline
    case 'mdi-checkbox-blank-circle-outline':
      return MdiCheckboxBlankCircleOutline
    case 'mdi-star':
      return MdiStar
    case 'mdi-star-outline':
      return MdiStarOutline
    case 'mdi-heart':
      return MdiHeart
    case 'mdi-heart-outline':
      return MdiHeartOutline
    case 'mdi-moon-full':
      return MdiMoonFull
    case 'mdi-moon-new':
      return MdiMoonNew
    case 'mdi-thumb-up':
      return MdiThumbUp
    case 'mdi-thumb-up-outline':
      return MdiThumbUpOutline
    case 'mdi-flag':
      return MdiFlag
    case 'mdi-flag-outline':
      return MdiFlagOutline
  }
}
</script>

<template>
  <div class="flex" :class="{ 'justify-center': !isForm, 'nc-cell-hover-show': !vModel }">
    <div class="px-1 pt-1 rounded-full items-center" :class="{ 'bg-gray-100': !vModel }" @click="vModel = !vModel">
      <component
        :is="icon(vModel ? checkboxMeta.icon.checked : checkboxMeta.icon.unchecked)"
        :style="{
          color: checkboxMeta.color,
        }"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-cell-hover-show {
  opacity: 0;
  transition: 0.3s opacity;
  &:hover {
    opacity: 0.7;
  }
}
</style>
