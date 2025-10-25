export enum PrintPageType {
  LETTER = 'Letter (8.5 x 11 inches)',
  LEGAL = 'Legal (8.5 x 14 inches)',
  A4 = 'A4 (8.268 x 11.693 inches)',
}

export enum PrintOrientation {
  PORTRAIT = 'Portrait',
  LANDSCAPE = 'Landscape',
}

interface PrintPageSize {
  type: PrintPageType
  format: string
  width: number
  height: number
}

const PAGE_SIZES: PrintPageSize[] = [
  {
    type: PrintPageType.LETTER,
    format: 'letter',
    width: 8.5,
    height: 11,
  },
  {
    type: PrintPageType.LEGAL,
    format: 'legal',
    width: 8.5,
    height: 14,
  },
  {
    type: PrintPageType.A4,
    format: 'a4',
    width: 8.268,
    height: 11.693,
  },
]

const ORIENTATIONS = [
  { type: PrintOrientation.PORTRAIT, value: 'portrait' as const },
  { type: PrintOrientation.LANDSCAPE, value: 'landscape' as const },
]

export const useScriptPlaygroundPrint = () => {
  const selectedPageSize = ref<PrintPageType>(PrintPageType.LETTER)
  const selectedOrientation = ref<PrintOrientation>(PrintOrientation.PORTRAIT)
  const isGenerating = ref(false)

  const pageSizes = computed(() => PAGE_SIZES)
  const orientations = computed(() => ORIENTATIONS)

  let clonedElement: HTMLElement | null = null

  const addPrintStyles = () => {
    const existingStyle = document.getElementById('playground-print-styles')
    if (existingStyle) {
      existingStyle.remove()
    }

    const pageSize = PAGE_SIZES.find((size) => size.type === selectedPageSize.value)
    const orientation = selectedOrientation.value === PrintOrientation.LANDSCAPE ? 'landscape' : 'portrait'

    const style = document.createElement('style')
    style.id = 'playground-print-styles'
    style.textContent = `
      @media print {
        /* Hide everything except print container */
        body > *:not(.print-playground-container) {
          display: none !important;
        }
        
        /* Page setup */
        @page {
          size: ${pageSize?.format || 'letter'} ${orientation};
          margin: 0.5in;
        }
        
        /* Reset body and html for print */
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-size: 11pt !important;
          line-height: 1.6 !important;
          color: black !important;
          height: auto !important;
          overflow: visible !important;
        }
        
        /* Style the print container */
        .print-playground-container {
          display: block !important;
          position: static !important;
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        .print-playground-container .playground-wrapper {
          width: 100% !important;
          max-width: none !important;
          padding-bottom: 0 !important;
        }
        
        /* Ensure all content flows properly */
        .print-playground-container * {
          overflow: visible !important;
          max-height: none !important;
        }
        
        /* Page break controls */
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid !important;
          page-break-inside: avoid !important;
        }
        
        .playground-item {
          page-break-inside: avoid !important;
        }
        
        .workflow-step-card {
          page-break-inside: avoid !important;
        }
        
        pre, blockquote, table, .nc-scripts-table {
          page-break-inside: avoid !important;
        }
      }
    `

    document.head.appendChild(style)
  }

  const removePrintStyles = () => {
    const existingStyle = document.getElementById('playground-print-styles')
    if (existingStyle) {
      existingStyle.remove()
    }
  }

  const printPlayground = async () => {
    const playgroundElement = document.querySelector('.nc-playground-container')
    if (!playgroundElement) {
      message.error('Playground content not found')
      return
    }

    isGenerating.value = true

    try {
      clonedElement = playgroundElement.cloneNode(true) as HTMLElement
      clonedElement.classList.add('print-playground-container')
      clonedElement.classList.remove('nc-playground-container')

      addPrintStyles()

      document.body.appendChild(clonedElement)

      await ncDelay(100)

      window.print()
    } catch (error) {
      console.error('Error opening print dialog:', error)
      message.error('Failed to print')
    } finally {
      setTimeout(() => {
        if (clonedElement && document.body.contains(clonedElement)) {
          document.body.removeChild(clonedElement)
          clonedElement = null
        }

        removePrintStyles()

        isGenerating.value = false
      }, 500)
    }
  }

  onUnmounted(() => {
    if (clonedElement && document.body.contains(clonedElement)) {
      document.body.removeChild(clonedElement)
    }
    removePrintStyles()
  })

  return {
    selectedPageSize,
    selectedOrientation,
    pageSizes,
    orientations,
    printPlayground,
    isGenerating,
  }
}
