export interface ExtensionManifest {
  id: string
  title: string
  subTitle: string
  description: string
  entry: string
  version: string
  iconUrl: string
  publisher: {
    name: string
    email: string
    url: string
    icon?: {
      src: string
      width?: number
      height?: number
    }
  }
  links: {
    title: string
    href: string
  }[]
  config: {
    modalSize?: 'xs' | 'sm' | 'md' | 'lg'
    contentMinHeight?: string
  }
  order: number
  disabled?: boolean
  type: 'extension'
}

export interface ScriptManifest {
  id: string
  title: string
  subTitle: string
  description: string
  entry: string
  version: string
  iconUrl: string
  publisher: {
    name: string
    email: string
    url: string
    icon?: {
      src: string
      width?: number
      height?: number
    }
  }
  links: {
    title: string
    href: string
  }[]
  order: number
  disabled?: boolean
  type: 'script'
}

export type PluginManifest = ExtensionManifest | ScriptManifest
