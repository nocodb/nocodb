import * as React from 'react';
import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

interface TeamMemberRoleUpdateTemplateProps {
  teamTitle: string;
  workspaceTitle?: string;
  updaterName: string;
  updaterEmail: string;
  oldRoleLabel: string;
  newRoleLabel: string;
  link: string;
}

export const TeamMemberRoleUpdate = ({
  teamTitle,
  workspaceTitle,
  updaterName,
  updaterEmail,
  oldRoleLabel,
  newRoleLabel,
  link,
}: TeamMemberRoleUpdateTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your team role has been updated</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your team role has been updated
          </Heading>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            <span className="font-bold text-gray-800">{updaterName}</span> ({updaterEmail})
            has updated your role in team <span className="font-bold text-gray-800">{teamTitle}</span>
            {workspaceTitle ? ` (workspace ${workspaceTitle})` : ''} from{' '}
            <span className="font-bold text-gray-800">{oldRoleLabel}</span> to{' '}
            <span className="font-bold text-gray-800">{newRoleLabel}</span>.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Open NocoDB</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

TeamMemberRoleUpdate.PreviewProps = {
  teamTitle: 'Team Name',
  workspaceTitle: 'Workspace Name',
  updaterName: 'John Doe',
  updaterEmail: 'johndoe@nocodb.com',
  oldRoleLabel: 'Member',
  newRoleLabel: 'Owner',
  link: 'https://app.nocodb.com',
};

export default TeamMemberRoleUpdate;


