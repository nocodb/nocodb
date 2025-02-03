export enum PageType {
  LETTER = 'Letter (8.5 x 11 inches)',
  LEGAL = 'Legal (8.5 x 14 inches)',
  A4 = 'A4 (8.268 x 11.693 inches)',
  INDEX_CARD = 'Index Card (3 x 5 inches)',
  BUSINESS_CARD = 'Business Card (2 x 3.5 inches)',
}

export enum PageOrientation {
  PORTRAIT = 'Portrait',
  LANDSCAPE = 'Landscape',
}

interface PageSizesInches {
  width: number
  height: number
  type: PageType
}

export class PageDesignerLayout {
  static get PageSizes(): PageSizesInches[] {
    return [
      {
        type: PageType.LETTER,
        width: 8.5,
        height: 11,
      },
      {
        type: PageType.LEGAL,
        width: 8.5,
        height: 14,
      },
      {
        type: PageType.A4,
        width: 8.268,
        height: 11.693,
      },
      {
        type: PageType.INDEX_CARD,
        width: 3,
        height: 5,
      },
      {
        type: PageType.BUSINESS_CARD,
        width: 2,
        height: 3.5,
      },
    ]
  }

  static get PageSizesByType() {
    return this.PageSizes.reduce((map, current) => {
      map[current.type] = current
      return map
    }, {} as Record<PageType, PageSizesInches>)
  }

  static getPageSizeInches(size: PageType) {
    return this.PageSizesByType[size]
  }

  static convertLengthFromInchesToPx(length: number) {
    return 109 * length
  }

  static convertSizeFromInchesToPx({ width, height }: PageSizesInches) {
    return {
      width: this.convertLengthFromInchesToPx(width),
      height: this.convertLengthFromInchesToPx(height),
    }
  }

  static getPageSizePx(pageType: PageType = PageType.A4, pageOrientation: PageOrientation = PageOrientation.PORTRAIT) {
    const sizeInches = this.getPageSizeInches(pageType)
    const { width, height } = this.convertSizeFromInchesToPx(sizeInches)
    return pageOrientation === PageOrientation.LANDSCAPE
      ? {
          width: height,
          height: Math.floor(width),
        }
      : {
          width,
          height: Math.floor(height),
        }
  }
}
