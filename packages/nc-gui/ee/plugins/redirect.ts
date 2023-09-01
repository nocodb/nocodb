if (window.location.search) {
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('redirect')) {
    const redirect = urlParams.get('redirect')
    // urlParams.delete('redirect')
    window.location.href = `./#${redirect}`
  }
}
