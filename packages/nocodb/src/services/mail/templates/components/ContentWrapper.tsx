import { Container, Hr, Img, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { WhiteLabelConfig } from 'nocodb-sdk';
import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';

export interface ContentWrapperProps {
  children: React.ReactNode;
  disableContainerPadding?: boolean;
  branding?: WhiteLabelConfig | null;
}

// Same-origin logo paths (e.g. /uploads/...) can't be resolved from an inbox,
// so we only embed white-label logos that are absolute http(s) URLs.
function pickEmailLogo(branding: WhiteLabelConfig | null | undefined): string | null {
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
  const productName = (isBranded && branding?.productName) || 'NocoDB';

  return (
    <Container className="px-3 mt-16 !my-0 max-w-[480px]">
      <Section className="py-6 m-auto bg-gray-50 border border-gray-200 border-solid rounded-t-xl">
        {customLogo ? (
          <Img
            alt={productName}
            src={customLogo}
            width={40}
            style={{ display: 'block', margin: 'auto auto', maxHeight: 40 }}
            height={40}
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
