import NcModalConfirm, { type NcConfirmModalProps } from '../components/nc/ModalConfirm.vue'

export type NcShowConfirmModalProps = Pick<
  NcConfirmModalProps,
  'type' | 'title' | 'content' | 'okText' | 'okClass' | 'showCancelBtn' | 'cancelText' | 'showIcon' | 'maskClosable' | 'keyboard'
>

const useNcConfirmModal = () => {
  const showConfirmModal = ({
    type,
    title,
    content,
    okText,
    okClass = '!px-4',
    cancelText,
    showIcon = false,
    maskClosable = true,
    keyboard = true,
    showCancelBtn = false,
  }: NcShowConfirmModalProps) => {
    const isOpen = ref(true)

    const { close } = useDialog(NcModalConfirm, {
      'visible': isOpen,
      'type': type,
      'title': title,
      'content': content,
      'okText': okText,
      'cancelText': cancelText,
      'onCancel': closeDialog,
      'onOk': closeDialog,
      'okClass': okClass,
      'update:visible': closeDialog,
      'showIcon': showIcon,
      'maskClosable': maskClosable,
      'keyboard': keyboard,
      'showCancelBtn': showCancelBtn,
    })

    function closeDialog() {
      isOpen.value = false
      close(1000)
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
  }
}

export default useNcConfirmModal
