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

interface SubscriptionCanceledTemplateProps {
  workspaceTitle: string;
  planTitle: string;
  endsAt?: string;
  billingPortalUrl: string;
}

export const SubscriptionCanceled = ({
  workspaceTitle,
  planTitle,
  endsAt,
  billingPortalUrl,
}: SubscriptionCanceledTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your subscription was canceled</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Subscription canceled
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Your <span className="font-bold text-gray-800">{planTitle}</span>{' '}
            subscription has been canceled.
          </Text>
          {endsAt ? (
            <Text className="text-gray-600 text-center text-sm !mt-0">
              You’ll keep access through{' '}
              <span className="font-bold text-gray-800">{endsAt}</span>.
            </Text>
          ) : (
            <Text className="text-gray-600 text-center text-sm !mt-0">
              Your workspace has been moved to the Free plan.
            </Text>
          )}
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Changed your mind? You can resubscribe anytime.
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

SubscriptionCanceled.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  planTitle: 'Business',
  endsAt: 'Jun 12, 2026',
  billingPortalUrl: 'https://app.nocodb.com/billing',
};

export default SubscriptionCanceled;
