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

interface OnPremSubscriptionCanceledTemplateProps {
  licensedTo: string;
  planTitle: string;
  stripeStatus: 'canceled' | 'unpaid';
  endsAt?: string;
  billingPortalUrl: string;
}

export const OnPremSubscriptionCanceled = ({
  licensedTo,
  planTitle,
  stripeStatus,
  endsAt,
  billingPortalUrl,
}: OnPremSubscriptionCanceledTemplateProps) => {
  const isUnpaid = stripeStatus === 'unpaid';
  return (
    <Html>
      <RootWrapper>
        <Head />
        <Preview>
          {isUnpaid
            ? 'Your NocoDB license has been suspended'
            : 'Your NocoDB subscription was canceled'}
        </Preview>
        <Body className="bg-white">
          <ContentWrapper>
            <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
              {isUnpaid ? 'License suspended' : 'Subscription canceled'}
            </Heading>
            <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
              {planTitle}
            </Section>
            <Text className="text-gray-600 text-center text-sm !mt-0">
              Licensed to{' '}
              <span className="font-bold text-gray-800">{licensedTo}</span>
            </Text>
            {isUnpaid ? (
              <>
                <Text className="text-gray-600 text-center text-sm !mt-0">
                  We weren’t able to bill your card after multiple retries.
                </Text>
                <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
                  Your license has been marked inactive and paid features on
                  your instance are disrupted. Update your payment details to
                  restore access.
                </Text>
              </>
            ) : (
              <>
                <Text className="text-gray-600 text-center text-sm !mt-0">
                  Your{' '}
                  <span className="font-bold text-gray-800">{planTitle}</span>{' '}
                  subscription has been canceled.
                </Text>
                {endsAt ? (
                  <Text className="text-gray-600 text-center text-sm !mt-0">
                    Until then everything keeps working — access ends{' '}
                    <span className="font-bold text-gray-800">{endsAt}</span>.
                  </Text>
                ) : (
                  <Text className="text-gray-600 text-center text-sm !mt-0">
                    Your installation has been suspended.
                  </Text>
                )}
                <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
                  Changed your mind? You can resubscribe anytime.
                </Text>
              </>
            )}
            <Button
              className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
              href={billingPortalUrl}
            >
              <Text className="!my-[8px]">
                {isUnpaid ? 'Restore license' : 'Manage billing'}
              </Text>
            </Button>
          </ContentWrapper>
          <Footer />
        </Body>
      </RootWrapper>
    </Html>
  );
};

OnPremSubscriptionCanceled.PreviewProps = {
  licensedTo: 'mert@nocodb.com',
  planTitle: 'Self-hosted Business',
  stripeStatus: 'unpaid',
  endsAt: 'Jun 12, 2026',
  billingPortalUrl: 'https://app.nocodb.com/account/self-hosted',
};

export default OnPremSubscriptionCanceled;
