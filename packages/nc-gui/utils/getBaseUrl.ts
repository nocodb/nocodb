export const getBaseUrl = () => {
  return process.env.NC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? '..' : 'http://localhost:8080')
}
