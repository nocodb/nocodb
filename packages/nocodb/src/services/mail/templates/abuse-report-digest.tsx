import {
  Body,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';
import type { WhiteLabelConfig } from 'nocodb-sdk';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

interface AbuseReportDigestTemplateProps {
  held: number;
  branding?: WhiteLabelConfig | null;
}

export const AbuseReportDigest = ({
  held,
  branding,
}: AbuseReportDigestTemplateProps) => (
  <Html>
    <RootWrapper branding={branding}>
      <Head />
      <Preview>Abuse reports were held back</Preview>
      <Body className="bg-white">
        <ContentWrapper branding={branding}>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Abuse reports were held back
          </Heading>
          <Text className="text-gray-600 text-center text-sm !mt-2 !mb-6">
            {held} {held === 1 ? 'report' : 'reports'} arrived in the last hour
            while notifications were paused for volume. They are stored and not
            listed here.
          </Text>
        </ContentWrapper>
        <Footer branding={branding} />
      </Body>
    </RootWrapper>
  </Html>
);

AbuseReportDigest.PreviewProps = { held: 12 };

export default AbuseReportDigest;
