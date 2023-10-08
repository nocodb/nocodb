export interface ActionsEE {
  getMainUrl: () => string | undefined
  checkForCognitoToken: (params?: { skipRedirect?: boolean }) => Promise<void>
}
