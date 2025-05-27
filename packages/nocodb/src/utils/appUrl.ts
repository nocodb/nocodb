import { serverConfig } from "config";

export const getAppUrl = () => {
  return `${serverConfig.publicUrl}${serverConfig.dashboardUrl}`;
};
