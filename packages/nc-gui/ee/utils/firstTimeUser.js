const localStorageKey = 'nc-gui-first-time-user'

// check if user is first time user
export const isFirstTimeUser = () => {
  return !localStorage.getItem(localStorageKey)
}

// update status in local storage
export const updateFirstTimeUser = () => {
  localStorage.setItem(localStorageKey, 'false')
}
