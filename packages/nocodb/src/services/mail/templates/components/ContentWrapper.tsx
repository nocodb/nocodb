import { Container, Hr, Img, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { WhiteLabelConfig } from 'nocodb-sdk';
import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';
import { resolveProductName } from '~/services/mail/templates/components/productName';

export interface ContentWrapperProps {
  children: React.ReactNode;
  disableContainerPadding?: boolean;
  branding?: WhiteLabelConfig | null;
}

// White-label logos resolve to an absolute, permanent asset-endpoint URL
// (built by `getPublicConfig` in white-label.service) which loads from an inbox
// and survives restarts. We still guard for http(s) so a manually-pasted
// same-origin path — which an inbox can't resolve — is dropped rather than
// rendered broken.
function pickEmailLogo(
  branding: WhiteLabelConfig | null | undefined,
): string | null {
  if (!branding?.enabled) return null;
  const candidate = branding.logoUrl || branding.logoDarkUrl;
  if (!candidate) return null;
  return /^https?:\/\//.test(candidate) ? candidate : null;
}

export const ContentWrapper = ({
  children,
  disableContainerPadding,
  branding,
}: ContentWrapperProps) => {
  const customLogo = pickEmailLogo(branding);
  const isBranded = !!branding?.enabled;
  const productName = resolveProductName(branding);

  return (
    <Container className="px-3 mt-16 !my-0 max-w-[480px]">
      <Section className="py-6 m-auto bg-gray-50 border border-gray-200 border-solid rounded-t-xl">
        {customLogo ? (
          // Custom logos are an unknown aspect ratio (often a ~4:1 wordmark),
          // so constrain the height and let the width scale — fixing both would
          // squash a landscape logo into a square. `maxWidth` guards a very wide
          // logo from overflowing the 480px container.
          <Img
            alt={productName}
            src={customLogo}
            height={40}
            style={{
              display: 'block',
              margin: 'auto auto',
              width: 'auto',
              maxHeight: 40,
              maxWidth: 240,
            }}
          />
        ) : isBranded ? (
          <Text className="text-center font-bold text-gray-900 !my-0 text-base">
            {productName}
          </Text>
        ) : (
          <Img
            alt="NocoDB"
            src={`${NC_EMAIL_ASSETS_BASE_URL}/nocodb-logo.png`}
            width={40}
            style={{ display: 'block', margin: 'auto auto' }}
            height={40}
          />
        )}
      </Section>
      <Section
        className={`border border-gray-200 border-solid border-t-0 rounded-b-xl bg-white ${
          disableContainerPadding ? 'p-0' : 'p-6'
        }`}
      >
        {children}
      </Section>

      <Hr className="!my-16" />
    </Container>
  );
};
