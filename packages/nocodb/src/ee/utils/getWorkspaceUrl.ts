export function getWorkspaceSiteUrl(param: {
  workspaceId: string;
  siteUrl?: string;
}) {
  if (process.env.NC_BASE_HOST_NAME) {
    return `https://${param.workspaceId}.${process.env.NC_BASE_HOST_NAME}`;
  }
  return param.siteUrl;
}
