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

interface HookErrorDigestTemplateProps {
  hookTitle: string;
  tableName: string;
  baseTitle: string;
  failureCount: number;
  firstFailureTime: string;
  lastFailureTime: string;
  link: string;
}

export const HookErrorDigest = ({
  hookTitle,
  tableName,
  baseTitle,
  failureCount,
  firstFailureTime,
  lastFailureTime,
  link,
}: HookErrorDigestTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Something went wrong with a webhook: {hookTitle}</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            {hookTitle}
          </Heading>
          <Section className="py-4 mx-auto text-center">
            <Text className="text-gray-600 text-sm !mt-0 !mb-4">
              Your webhook <span className="font-bold text-gray-800">{hookTitle}</span> on
              table <span className="font-bold text-gray-800">{tableName}</span> has
              failed <span className="font-bold text-red-600">{failureCount} {failureCount === 1 ? 'time' : 'times'}</span> in{' '}
              <span className="font-bold text-gray-800">{baseTitle}</span>
              {failureCount > 1 ? (
                <> between {firstFailureTime} and {lastFailureTime}.</>
              ) : (
                <> at {lastFailureTime}.</>
              )}
            </Text>
          </Section>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">View webhook logs</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

HookErrorDigest.PreviewProps = {
  hookTitle: 'My Webhook',
  tableName: 'Orders',
  baseTitle: 'Project Base',
  failureCount: 3,
  firstFailureTime: '01/31/2026 at 8:19 AM UTC',
  lastFailureTime: '01/31/2026 at 8:21 AM UTC',
  link: 'https://app.nocodb.com',
};

export default HookErrorDigest;
