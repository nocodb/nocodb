import NcModalConfirm, { type NcConfirmModalProps } from '../components/nc/ModalConfirm.vue'

export type NcShowConfirmModalProps = Pick<
  NcConfirmModalProps,
  | 'type'
  | 'title'
  | 'content'
  | 'okText'
  | 'okClass'
  | 'showCancelBtn'
  | 'cancelText'
  | 'showIcon'
  | 'maskClosable'
  | 'keyboard'
  | 'okProps'
> & {
  /**
   * Use key to avoid showing multiple modals
   */
  key?: string
  okCallback?: () => Promise<void>
  initialSlots?: MaybeRef<Record<string, () => VNode[]>>
  showOkLoading?: boolean
}

const useNcConfirmModal = () => {
  const showModalCount = ref(0)

  const openedModalKeyMap = ref<Record<string, boolean>>({})

  const activeModals: Record<string, () => void> = {} // store closeDialog callbacks

  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      // Close all modals on hot reload
      Object.values(activeModals).forEach((fn) => fn())
      Object.assign(activeModals, {})
      openedModalKeyMap.value = {}
    })
  }

  const getModalKey = () => {
    const modalKey = `confirm-modal-${++showModalCount.value}`

    if (openedModalKeyMap.value[modalKey]) {
      return getModalKey()
    }

    return modalKey
  }

  const showConfirmModal = ({
    type,
    title,
    content,
    okText,
    okClass = '!px-4',
    cancelText,
    showIcon = true,
    maskClosable = true,
    keyboard = true,
    showCancelBtn = false,
    key,
    okProps: _okProps = {},
    okCallback = () => Promise.resolve(),
    initialSlots = {},
    showOkLoading,
  }: NcShowConfirmModalProps) => {
    key = key || getModalKey()

    if (openedModalKeyMap.value[key]) {
      return
    }

    openedModalKeyMap.value[key] = true

    const isOpen = ref(true)

    const okProps = ref({ loading: false, ..._okProps })

    const slots = ref<Record<string, () => VNode[]>>(toValue(initialSlots))

    const { close } = useDialog(
      NcModalConfirm,
      {
        'visible': isOpen,
        'type': type,
        'title': title,
        'content': content,
        'okText': okText,
        'cancelText': cancelText,
        'onCancel': () => closeDialog(key),
        'onOk': async () => {
          if (showOkLoading) {
            okProps.value.loading = true

            await okCallback()

            okProps.value.loading = false
          } else {
            await okCallback()
          }

          closeDialog()
        },
        'okClass': okClass,
        'okProps': okProps,
        'update:visible': () => closeDialog(key),
        'showIcon': showIcon,
        'maskClosable': maskClosable,
        'keyboard': keyboard,
        'showCancelBtn': showCancelBtn,
      },
      {
        slots,
      },
    )

    function closeDialog(modalKey?: string) {
      isOpen.value = false

      if (modalKey) {
        delete openedModalKeyMap.value[modalKey]
        delete activeModals[modalKey]
      }

      close(1000)
    }

    // Keep closeDialog for HMR cleanup
    if (key) {
      activeModals[key] = () => closeDialog(key)
    }
  }

  return {
    showInfoModal: (props: Omit<NcShowConfirmModalProps, 'type'>) => {
      showConfirmModal({ ...props, type: 'info' })
    },
    showSuccessModal: (props: Omit<NcShowConfirmModalProps, 'type'>) => {
      showConfirmModal({ ...props, type: 'success' })
    },
    showWarningModal: (props: Omit<NcShowConfirmModalProps, 'type'>) => {
      showConfirmModal({ ...props, type: 'warning' })
    },
    showErrorModal: (props: Omit<NcShowConfirmModalProps, 'type'>) => {
      showConfirmModal({ ...props, type: 'error' })
    },
    openedModalKeyMap,
  }
}

export default useNcConfirmModal
