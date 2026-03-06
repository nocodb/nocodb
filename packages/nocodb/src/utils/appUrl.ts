export const getAppUrl = () => {
  const siteUrl =
    process.env.NC_PUBLIC_URL || `http://localhost:${process.env.PORT || 8080}`;

  const dashboardUrl = process.env.NC_DASHBOARD_URL;

  // If NC_DASHBOARD_URL is a full URL (split-frontend mode), use it directly.
  // Otherwise the frontend lives at root, so just use siteUrl.
  return dashboardUrl?.startsWith('http') ? dashboardUrl : siteUrl;
};
