const isElementInvisible = (elem: HTMLElement) => {
  return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length)
}

/**
 * Waits until the smooth scrolling animation completes.
 * Supports both `window` scrolling and scrolling inside an element.
 *
 * @param {HTMLElement | Window} element - The element (or window) to track scrolling on.
 * @returns {Promise<void>} Resolves when scrolling has stopped.
 */
const waitForScrollEnd = (element: HTMLElement | Window = window) => {
  return new Promise<void>((resolve) => {
    // Get initial scroll positions
    let lastX = element instanceof Window ? window.scrollX : (element as HTMLElement).scrollLeft
    let lastY = element instanceof Window ? window.scrollY : (element as HTMLElement).scrollTop

    /**
     * Checks if scrolling has stopped by comparing the last and current positions.
     * If scrolling continues, it recursively calls itself using `requestAnimationFrame`.
     */
    const checkScroll = () => {
      const currentX = element instanceof Window ? window.scrollX : (element as HTMLElement).scrollLeft
      const currentY = element instanceof Window ? window.scrollY : (element as HTMLElement).scrollTop

      // If positions are nearly the same, scrolling has stopped
      if (Math.abs(currentX - lastX) < 1 && Math.abs(currentY - lastY) < 1) {
        resolve() // Resolve the promise
      } else {
        // Update last positions and continue checking
        lastX = currentX
        lastY = currentY
        requestAnimationFrame(checkScroll)
      }
    }

    // Small delay to allow smooth scroll animation to begin
    setTimeout(() => {
      requestAnimationFrame(checkScroll)
    }, 50)
  })
}

export { isElementInvisible, waitForScrollEnd }
