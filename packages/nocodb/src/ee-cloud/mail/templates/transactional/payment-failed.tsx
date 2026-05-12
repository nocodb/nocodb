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

interface PaymentFailedTemplateProps {
  workspaceTitle: string;
  amountDue: string;
  attemptCount: number;
  nextAttemptAt?: string;
  failureMessage?: string;
  billingPortalUrl: string;
}

export const PaymentFailed = ({
  workspaceTitle,
  amountDue,
  attemptCount,
  nextAttemptAt,
  failureMessage,
  billingPortalUrl,
}: PaymentFailedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Action required — your payment failed</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Payment failed
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            We weren’t able to charge your payment method for{' '}
            <span className="font-bold text-gray-800">{amountDue}</span>.
          </Text>
          {failureMessage ? (
            <Text className="text-gray-600 text-center text-sm !mt-0">
              Reason from your bank:{' '}
              <span className="font-bold text-gray-800">{failureMessage}</span>
            </Text>
          ) : null}
          <Text className="text-gray-600 text-center text-sm !mt-0">
            This was attempt{' '}
            <span className="font-bold text-gray-800">{attemptCount}</span>.
            {nextAttemptAt
              ? ` We’ll retry on ${nextAttemptAt}.`
              : ' Please update your billing details before service is disrupted.'}
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Update your payment method to avoid losing access.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={billingPortalUrl}
          >
            <Text className="!my-[8px]">Manage billing</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

PaymentFailed.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  amountDue: '$49.00 USD',
  attemptCount: 1,
  nextAttemptAt: 'May 15, 2026',
  failureMessage: 'Your card was declined.',
  billingPortalUrl: 'https://app.nocodb.com/billing',
};

export default PaymentFailed;
