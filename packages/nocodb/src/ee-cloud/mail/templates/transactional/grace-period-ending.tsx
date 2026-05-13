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

interface GracePeriodEndingTemplateProps {
  workspaceTitle: string;
  limitLabel: string;
  currentUsage: number;
  limitValue: number;
  daysRemaining: number;
  gracePeriodEndsAt: string;
  upgradeUrl: string;
}

export const GracePeriodEnding = ({
  workspaceTitle,
  limitLabel,
  currentUsage,
  limitValue,
  daysRemaining,
  gracePeriodEndsAt,
  upgradeUrl,
}: GracePeriodEndingTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Grace period ending soon</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your grace period is ending
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            You have{' '}
            <span className="font-bold text-gray-800">
              {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
            </span>{' '}
            left before write restrictions take effect on{' '}
            <span className="font-bold text-gray-800">{gracePeriodEndsAt}</span>
            .
          </Text>
          {currentUsage > 0 && limitValue > 0 ? (
            <Text className="text-gray-600 text-center text-sm !mt-0">
              Current usage of{' '}
              <span className="font-bold text-gray-800">{limitLabel}</span>:{' '}
              {currentUsage} (limit: {limitValue}).
            </Text>
          ) : null}
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Upgrade now to keep collaborating without interruption.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={upgradeUrl}
          >
            <Text className="!my-[8px]">Upgrade your plan</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

GracePeriodEnding.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  limitLabel: 'records',
  currentUsage: 1200,
  limitValue: 1000,
  daysRemaining: 3,
  gracePeriodEndsAt: 'May 15, 2026',
  upgradeUrl: 'https://app.nocodb.com/billing',
};

export default GracePeriodEnding;
