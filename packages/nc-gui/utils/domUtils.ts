const isElementInvisible = (elem: HTMLElement) => {
  return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length)
}

export { isElementInvisible }
