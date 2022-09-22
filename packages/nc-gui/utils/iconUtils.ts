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
import MdiTableLarge from '~icons/mdi/table-large'
import MdiEyeCircleOutline from '~icons/mdi/eye-circle-outline'
import MdiAccountGroup from '~icons/mdi/account-group'

export const iconMap = {
  'mdi-check-bold': MdiCheckBold,
  'mdi-crop-square': MdiCropSquare,
  'mdi-check-circle-outline': MdiCheckCircleOutline,
  'mdi-checkbox-blank-circle-outline': MdiCheckboxBlankCircleOutline,
  'mdi-star': MdiStar,
  'mdi-star-outline': MdiStarOutline,
  'mdi-heart': MdiHeart,
  'mdi-heart-outline': MdiHeartOutline,
  'mdi-moon-full': MdiMoonFull,
  'mdi-moon-new': MdiMoonNew,
  'mdi-thumb-up': MdiThumbUp,
  'mdi-thumb-up-outline': MdiThumbUpOutline,
  'mdi-flag': MdiFlag,
  'mdi-flag-outline': MdiFlagOutline,
  'mdi-table-large': MdiTableLarge,
  'mdi-eye-circle-outline': MdiEyeCircleOutline,
  'mdi-account-group': MdiAccountGroup,
} as const

export const getMdiIcon = (type: string): any => {
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
    case 'mdi-table-large':
      return MdiTableLarge
    case 'mdi-eye-circle-outline':
      return MdiEyeCircleOutline
    case 'mdi-account-group':
      return MdiAccountGroup
  }
}
