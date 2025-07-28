import type { ProjectRoles } from 'nocodb-sdk'

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
  /**
   * `beta` used for extension visibility.
   */
  beta?: boolean
  onPrem?: boolean
  /**
   * The minimum access role required to access the extension.
   * @default ProjectRoles.CREATOR
   * Todo: @rameshmane7218
   */
  minAccessRole?: ProjectRoles
  /**
   * `showAsBeta` released as a beta extension.
   * We will add beta tab in market, details and extension places.
   */
  showAsBeta?: boolean
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
  beta?: boolean
  onPrem?: boolean
}

export type PluginManifest = ExtensionManifest | ScriptManifest

export interface ExtensionConfigInjType {
  activeExtensionId?: string
  isPageDesignerPreviewPanel?: boolean
  [key: string]: any
}
