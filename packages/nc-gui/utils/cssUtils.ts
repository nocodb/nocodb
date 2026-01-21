export const onboardingFlowColoursMapping: Record<string, { lightBg: string; content: string }> = {
  brand: {
    lightBg: 'bg-nc-bg-brand',
    content: 'text-nc-content-brand',
  },
  orange: {
    lightBg: 'bg-nc-bg-orange-light',
    content: 'text-nc-content-orange-dark',
  },
  green: {
    lightBg: 'bg-nc-bg-green-light',
    content: 'text-nc-content-green-dark',
  },
  purple: {
    lightBg: 'bg-nc-bg-purple-light',
    content: 'text-nc-content-purple-dark',
  },
  pink: {
    lightBg: 'bg-nc-bg-pink-light',
    content: 'text-nc-content-pink-dark',
  },
}

export const roleColorsMapping: Record<
  string,
  {
    bg: string
    content: string
    contentTooltip: string
    badgeClass?: string
  }
> = {
  purple: {
    bg: 'bg-nc-bg-purple-light',
    content: 'text-nc-content-purple-dark',
    contentTooltip: 'text-nc-purple-200',
  },
  blue: {
    bg: 'bg-nc-bg-blue-light',
    content: 'text-nc-content-blue-dark',
    contentTooltip: 'text-nc-blue-200',
  },
  green: {
    bg: 'bg-nc-bg-green-light',
    content: 'text-nc-content-green-dark',
    contentTooltip: 'text-nc-green-200',
  },
  orange: {
    bg: 'bg-nc-bg-orange-light',
    content: 'text-nc-content-orange-dark',
    contentTooltip: 'text-nc-orange-200',
  },
  yellow: {
    bg: 'bg-nc-bg-yellow-light',
    content: 'text-nc-content-yellow-dark',
    contentTooltip: 'text-nc-yellow-200',
  },
  red: {
    bg: 'bg-nc-bg-red-light',
    content: 'text-nc-content-red-dark',
    contentTooltip: 'text-nc-red-200',
  },
  maroon: {
    bg: 'bg-nc-bg-maroon-light',
    content: 'text-nc-content-maroon-dark',
    contentTooltip: 'text-nc-maroon-200',
  },
  disabled: {
    bg: 'bg-nc-bg-gray-light',
    content: 'text-nc-content-gray-disabled',
    contentTooltip: 'text-nc-gray-200',
  },
  gray: {
    bg: 'bg-nc-bg-gray-medium',
    content: 'text-nc-content-gray-subtle2',
    contentTooltip: 'text-nc-gray-200',
    badgeClass: '!bg-nc-bg-gray-medium !border-nc-border-gray-medium',
  },
}

export const getTableAndFieldPermissionsColors = (color: string) => {
  switch (color) {
    case 'purple':
      return 'text-purple-700'
    case 'blue':
      return 'text-blue-700 dark:text-nc-blue-500'
    case 'green':
      return 'text-green-700 dark:text-nc-green-600'
    case 'orange':
      return 'text-orange-700'
    case 'yellow':
      return 'text-yellow-700'
    case 'red':
      return 'text-red-700 dark:text-nc-red-500'
    case 'maroon':
      return 'text-maroon-700'
    case 'gray':
    default:
      return 'text-gray-700 dark:text-nc-gray-600'
  }
}

export const extensionClassNames = {
  pageDesignerRemovable:
    'absolute w-5 h-5 px-2 bg-nc-bg-default rounded-md hover:bg-nc-bg-gray-light border-1 cursor-pointer border-nc-border-gray-medium justify-center items-center gap-2 inline-flex',
}

export const erdNodeClassNames = {
  node: 'rounded-lg border-1 border-nc-border-gray-medium shadow-lg',
}
