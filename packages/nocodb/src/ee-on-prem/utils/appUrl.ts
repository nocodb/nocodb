let siteUrl: string;

// extract url from license key jwt payload
export const getAppUrl = () => {
  if (!siteUrl) {
    // extract from license key jwt payload
    try {
      const key = process.env.NC_LICENSE_KEY;
      // extract payload
      const payload = key.split('.')[1];
      // decode payload
      const decodedPayload = Buffer.from(payload, 'base64').toString();
      // parse payload
      const parsedPayload = JSON.parse(decodedPayload);
      // extract site url
      siteUrl = parsedPayload.siteUrl;
    } catch {
      // if error then fallback to default
      siteUrl =
        process.env.NC_PUBLIC_URL ||
        `http://localhost:${process.env.PORT || 8080}`;
    }
  }
  return `${siteUrl}${process.env.NC_DASHBOARD_URL ?? '/'}`;
};
