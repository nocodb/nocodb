import html2pdf from 'html2pdf.js'

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

  const printPlayground = async () => {
    const playgroundElement = document.querySelector('.nc-playground-container')
    if (!playgroundElement) {
      message.error('Playground content not found')
      return
    }

    const pageSize = PAGE_SIZES.find((size) => size.type === selectedPageSize.value)
    if (!pageSize) {
      message.error('Invalid page size selected')
      return
    }

    isGenerating.value = true

    try {
      const playgroundContent = playgroundElement.querySelector('.flex.mx-auto.flex-col') || playgroundElement

      // Clone the content
      const clonedContent = playgroundContent.cloneNode(true) as HTMLElement

      // Calculate dimensions based on orientation
      const isLandscape = selectedOrientation.value === PrintOrientation.LANDSCAPE
      const pageWidth = isLandscape ? pageSize.height : pageSize.width

      // Create a clean wrapper for PDF
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `
        width: ${pageWidth - 1}in;
        padding: 24px;
        background-color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #1f2937;
      `

      // Clean up the cloned content
      clonedContent.style.cssText = `
        max-width: 100%;
        display: flex;
        flex-direction: column;
        gap: 24px;
      `
      // Fix workflow step cards
      const workflowCards = clonedContent.querySelectorAll('.workflow-step-card')
      workflowCards.forEach((card) => {
        const htmlCard = card as HTMLElement
        htmlCard.style.cssText = `
          border: 1px solid;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 16px;
          page-break-inside: avoid;
          break-inside: avoid;
        `
      })

      // Fix step headers
      const stepHeaders = clonedContent.querySelectorAll('.step-header')
      stepHeaders.forEach((header) => {
        const htmlHeader = header as HTMLElement
        htmlHeader.style.cssText = `
          padding: 16px;
          border-bottom: 1px solid;
        `
      })

      // Fix step content
      const stepContents = clonedContent.querySelectorAll('.step-content')
      stepContents.forEach((content) => {
        const htmlContent = content as HTMLElement
        htmlContent.style.cssText = `
          padding: 16px;
        `
      })

      // Fix tables
      const tables = clonedContent.querySelectorAll('.nc-scripts-table')
      tables.forEach((table) => {
        const htmlTable = table as HTMLElement
        htmlTable.style.cssText = `
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #d1d5db;
          margin: 8px 0;
        `

        const cells = table.querySelectorAll('th, td')
        cells.forEach((cell) => {
          const htmlCell = cell as HTMLElement
          htmlCell.style.cssText = `
            border: 1px solid #d1d5db;
            padding: 8px;
            text-align: left;
          `
        })

        const headers = table.querySelectorAll('thead')
        headers.forEach((thead) => {
          const htmlThead = thead as HTMLElement
          htmlThead.style.backgroundColor = '#f9fafb'
        })
      })

      // Fix playground items
      const playgroundItems = clonedContent.querySelectorAll('.playground-item')
      playgroundItems.forEach((item) => {
        const htmlItem = item as HTMLElement
        htmlItem.style.cssText = `
          page-break-inside: avoid;
          break-inside: avoid;
          margin-bottom: 16px;
        `
      })

      // Fix prose/markdown content
      const proseElements = clonedContent.querySelectorAll('.prose')
      proseElements.forEach((prose) => {
        const htmlProse = prose as HTMLElement
        htmlProse.style.maxWidth = '100%'
      })

      wrapper.appendChild(clonedContent)

      // Get orientation value
      const orientationValue = ORIENTATIONS.find((o) => o.type === selectedOrientation.value)?.value || 'portrait'

      // Configure html2pdf options
      const options = {
        margin: 0.5,
        filename: `playground-output-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: (pageWidth - 1) * 96,
          onclone: (clonedDoc: Document) => {
            // Ensure all styles are computed in the cloned document
            const clonedWrapper = clonedDoc.body.querySelector('div')
            if (clonedWrapper) {
              clonedWrapper.style.display = 'block'
            }
          },
        },
        jsPDF: {
          unit: 'in',
          format: pageSize.format,
          orientation: orientationValue,
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }

      await html2pdf().set(options).from(wrapper).save()

      message.success('PDF generated successfully')
    } catch (error) {
      console.error('Error generating PDF:', error)
      message.error('Failed to generate PDF')
    } finally {
      isGenerating.value = false
    }
  }

  return {
    selectedPageSize,
    selectedOrientation,
    pageSizes,
    orientations,
    printPlayground,
    isGenerating,
  }
}
