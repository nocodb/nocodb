import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

interface OnPremLicenseIssuedTemplateProps {
  licensedTo: string;
  licenseKey: string;
  planTitle: string;
  seatCount: number;
  period: 'month' | 'year';
  periodEnd?: string;
  activationDocsUrl: string;
  setupDocsUrl: string;
  billingPortalUrl: string;
}

export const OnPremLicenseIssued = ({
  licensedTo,
  licenseKey,
  planTitle,
  seatCount,
  period,
  periodEnd,
  activationDocsUrl,
  setupDocsUrl,
  billingPortalUrl,
}: OnPremLicenseIssuedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your NocoDB on-premise license is ready</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your license is ready
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {planTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Licensed to{' '}
            <span className="font-bold text-gray-800">{licensedTo}</span>
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Seats: <span className="font-bold text-gray-800">{seatCount}</span>{' '}
            · Billed{' '}
            <span className="font-bold text-gray-800">
              {period === 'year' ? 'annually' : 'monthly'}
            </span>
            {periodEnd ? (
              <>
                {' '}
                · Next renewal{' '}
                <span className="font-bold text-gray-800">{periodEnd}</span>
              </>
            ) : null}
          </Text>
          <Section className="my-6">
            <Text className="text-gray-600 text-sm !mb-2">License key:</Text>
            <Text className="font-mono text-gray-900 text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 break-all !my-0">
              {licenseKey}
            </Text>
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Follow the activation guide to apply this key to your instance.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={activationDocsUrl}
          >
            <Text className="!my-[8px]">Activation guide</Text>
          </Button>
          <Text className="text-gray-600 text-center text-sm !mt-6 !mb-2">
            New to self-hosting NocoDB? Start with our setup guide for
            deployment options and prerequisites.
          </Text>
          <Text className="text-center text-sm !mt-0 !mb-2">
            <a href={setupDocsUrl} className="text-brand-500 underline">
              Self-hosting setup guide
            </a>
          </Text>
          <Text className="text-center text-sm !mt-0 !mb-0">
            <a href={billingPortalUrl} className="text-brand-500 underline">
              Manage billing
            </a>
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

OnPremLicenseIssued.PreviewProps = {
  licensedTo: 'mert@nocodb.com',
  licenseKey: 'nc_AbCdEf0123456789AbCdEf0123456789',
  planTitle: 'Self-hosted Business',
  seatCount: 10,
  period: 'year',
  periodEnd: 'May 12, 2027',
  activationDocsUrl: 'https://nocodb.com/docs/self-hosting/license-activation',
  setupDocsUrl: 'https://nocodb.com/docs/self-hosting',
  billingPortalUrl: 'https://app.nocodb.com/account/self-hosted',
};

export default OnPremLicenseIssued;
