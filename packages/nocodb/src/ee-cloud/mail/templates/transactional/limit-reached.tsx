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

interface LimitReachedTemplateProps {
  workspaceTitle: string;
  limitLabel: string;
  currentUsage: number;
  limitValue: number;
  gracePeriodEndsAt: string;
  upgradeUrl: string;
}

export const LimitReached = ({
  workspaceTitle,
  limitLabel,
  currentUsage,
  limitValue,
  gracePeriodEndsAt,
  upgradeUrl,
}: LimitReachedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your workspace has hit a plan limit</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            You’ve hit a plan limit
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Your workspace has reached the{' '}
            <span className="font-bold text-gray-800">{limitLabel}</span> limit
            on its current plan
            {currentUsage > 0 && limitValue > 0
              ? ` (${currentUsage} of ${limitValue}).`
              : '.'}
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            A 14-day grace period is now active. New writes that exceed the
            limit will be blocked after{' '}
            <span className="font-bold text-gray-800">{gracePeriodEndsAt}</span>{' '}
            unless you upgrade.
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Upgrade now to keep your team unblocked and your data flowing.
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

LimitReached.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  limitLabel: 'records',
  currentUsage: 1200,
  limitValue: 1000,
  gracePeriodEndsAt: 'May 26, 2026',
  upgradeUrl: 'https://app.nocodb.com/billing',
};

export default LimitReached;
