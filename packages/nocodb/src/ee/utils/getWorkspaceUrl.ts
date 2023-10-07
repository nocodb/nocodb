export function getWorkspaceSiteUrl(param: {
  workspaceId: string;
  siteUrl?: string;
  mainSubDomain: string;
}) {
  if (process.env.NC_BASE_HOST_NAME) {
    return `https://${param.mainSubDomain}.${process.env.NC_BASE_HOST_NAME}`;
  }
  return param.siteUrl;
}
