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

export function getMdiIcon(type: string) {
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
