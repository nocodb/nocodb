const isElementInvisible = (el: HTMLElement | Element) => {
  const rect = el.getBoundingClientRect()
  return rect.bottom < 0 || rect.right < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight
}

export { isElementInvisible }
