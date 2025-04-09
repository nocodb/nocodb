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

interface WorkspaceRequestUpgradeTemplateProps {
  workspaceTitle: string;
  name: string;
  email: string;
  link: string;
  limitOrFeature: string;
}

export const WorkspaceRequestUpgrade = ({
  workspaceTitle,
  name,
  email,
  link,
  limitOrFeature,
}: WorkspaceRequestUpgradeTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Upgrade Request For {workspaceTitle}</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Upgrade Request For {workspaceTitle}
          </Heading>
          <Section className="py-6 text-center">
            <span className="font-bold text-gray-900 text-base">
              {limitOrFeature}
            </span>
          </Section>
          <Text className="text-gray-600 text-center text-sm !mb-6 !mt-0">
            <span className="font-bold text-gray-800">{`${name} `}</span>(
            {email}) has requested an upgrade for the {limitOrFeature} in the
            <span className="font-semibold text-gray-800">
              {' '}
              {workspaceTitle}{' '}
            </span>
            workspace.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Upgrade</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

WorkspaceRequestUpgrade.PreviewProps = {
  workspaceTitle: 'Workspace Title',
  name: 'John Doe',
  email: 'john@nocodb.com',
  link: 'https://nocodb.com',
  limitOrFeature: 'Feature/Limit',
};

export default WorkspaceRequestUpgrade;
