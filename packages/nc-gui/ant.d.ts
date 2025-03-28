import type { MessageApi as AntMessageApi, MessageType } from 'ant-design-vue/es'

declare module 'ant-design-vue/es/message' {
  interface MessageApi extends Omit<AntMessageApi, 'success' | 'error' | 'info' | 'warn' | 'warning'> {
    success(params?: NcMessageProps, duration?: number, ncMessageExtraProps?: NcMessageExtraProps): MessageType
    error(params?: NcMessageProps, duration?: number, ncMessageExtraProps?: NcMessageExtraProps): MessageType
    info(params?: NcMessageProps, duration?: number, ncMessageExtraProps?: NcMessageExtraProps): MessageType
    warning(params?: NcMessageProps, duration?: number, ncMessageExtraProps?: NcMessageExtraProps): MessageType
    warn: MessageApi['warning'] // Ensure `warn` and `warning` share the same signature
  }
}
