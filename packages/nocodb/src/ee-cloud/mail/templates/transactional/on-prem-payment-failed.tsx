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

interface OnPremPaymentFailedTemplateProps {
  licensedTo: string;
  planTitle: string;
  invoiceLabel: string;
  amountDue: string;
  attemptCount: number;
  nextAttemptAt?: string;
  failureMessage?: string;
  hostedInvoiceUrl?: string;
  billingPortalUrl: string;
}

export const OnPremPaymentFailed = ({
  licensedTo,
  planTitle,
  invoiceLabel,
  amountDue,
  attemptCount,
  nextAttemptAt,
  failureMessage,
  hostedInvoiceUrl,
  billingPortalUrl,
}: OnPremPaymentFailedTemplateProps) => {
  const payHref = hostedInvoiceUrl || billingPortalUrl;
  return (
    <Html>
      <RootWrapper>
        <Head />
        <Preview>Payment verification needed for your NocoDB license</Preview>
        <Body className="bg-white">
          <ContentWrapper>
            <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
              Payment verification needed
            </Heading>
            <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
              {planTitle}
            </Section>
            <Text className="text-gray-600 text-center text-sm !mt-0">
              Licensed to{' '}
              <span className="font-bold text-gray-800">{licensedTo}</span>
            </Text>
            <Text className="text-gray-600 text-center text-sm !mt-0">
              Invoice{' '}
              <span className="font-bold text-gray-800">{invoiceLabel}</span>{' '}
              for <span className="font-bold text-gray-800">{amountDue}</span>{' '}
              could not be charged.
            </Text>
            {failureMessage ? (
              <Text className="text-gray-600 text-center text-sm !mt-0">
                Reason from your bank:{' '}
                <span className="font-bold text-gray-800">
                  {failureMessage}
                </span>
              </Text>
            ) : null}
            <Text className="text-gray-600 text-center text-sm !mt-0">
              This was attempt{' '}
              <span className="font-bold text-gray-800">{attemptCount}</span>.
              {nextAttemptAt
                ? ` We’ll retry on ${nextAttemptAt}.`
                : ' Please complete payment before retries are exhausted.'}
            </Text>
            <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
              If the invoice remains unpaid after retries, your license will be
              marked inactive and paid features on your instance will be
              disrupted.
            </Text>
            <Button
              className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
              href={payHref}
            >
              <Text className="!my-[8px]">Complete payment</Text>
            </Button>
            {hostedInvoiceUrl ? (
              <Text className="text-center text-sm !mt-4 !mb-0">
                <a href={billingPortalUrl} className="text-brand-500 underline">
                  Manage billing
                </a>
              </Text>
            ) : null}
          </ContentWrapper>
          <Footer />
        </Body>
      </RootWrapper>
    </Html>
  );
};

OnPremPaymentFailed.PreviewProps = {
  licensedTo: 'mert@nocodb.com',
  planTitle: 'Self-hosted Business',
  invoiceLabel: '7TD6F2DF-0002',
  amountDue: '$240.00 USD',
  attemptCount: 1,
  nextAttemptAt: 'May 15, 2026',
  failureMessage: 'Your bank required additional verification.',
  hostedInvoiceUrl: 'https://invoice.stripe.com/i/example',
  billingPortalUrl: 'https://app.nocodb.com/account/self-hosted',
};

export default OnPremPaymentFailed;
