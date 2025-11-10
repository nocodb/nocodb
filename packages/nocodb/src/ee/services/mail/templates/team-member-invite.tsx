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

interface TeamMemberInviteTemplateProps {
  teamTitle: string;
  workspaceTitle?: string;
  inviterName: string;
  inviterEmail: string;
  roleLabel: string;
  link: string;
}

export const TeamMemberInvite = ({
  teamTitle,
  workspaceTitle,
  inviterName,
  inviterEmail,
  roleLabel,
  link,
}: TeamMemberInviteTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>You've been added to a team</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            You've been added to a team
          </Heading>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            <span className="font-bold text-gray-800">{inviterName}</span> ({inviterEmail})
            has added you to the team <span className="font-bold text-gray-800">{teamTitle}</span>
            {workspaceTitle ? ` in workspace ${workspaceTitle}` : ''} with role{' '}
            <span className="font-bold text-gray-800">{roleLabel}</span>.
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

TeamMemberInvite.PreviewProps = {
  teamTitle: 'Team Name',
  workspaceTitle: 'Workspace Name',
  inviterName: 'John Doe',
  inviterEmail: 'johndoe@nocodb.com',
  roleLabel: 'Owner',
  link: 'https://app.nocodb.com',
};

export default TeamMemberInvite;


