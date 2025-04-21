import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
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
  email?: string;
  link: string;
  limitOrFeature: string;
}

export const WorkspaceRequestUpgrade = ({
  workspaceTitle,
  name,
  email: _email,
  link,
  limitOrFeature: _limitOrFeature,
}: WorkspaceRequestUpgradeTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>
        {name} Requested To Upgrade '{workspaceTitle}' Workspace
      </Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            {name} Requested To Upgrade '{workspaceTitle}' Workspace
          </Heading>

          <Text className="text-gray-600 text-center text-sm !my-6">
            Activate the upgrade to remove limits and power up your entire team.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Continue to upgrade</Text>
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
