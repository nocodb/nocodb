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
import type { WhiteLabelConfig } from 'nocodb-sdk';
import {
  ContentWrapper,
  Footer,
  resolveProductName,
  RootWrapper,
} from '~/services/mail/templates/components';

interface TeamMemberInviteTemplateProps {
  teamTitle: string;
  workspaceTitle?: string;
  inviterName: string;
  inviterEmail: string;
  roleLabel: string;
  link: string;
  branding?: WhiteLabelConfig | null;
}

export const TeamMemberInvite = ({
  teamTitle,
  workspaceTitle,
  inviterName,
  inviterEmail,
  roleLabel,
  link,
  branding,
}: TeamMemberInviteTemplateProps) => (
  <Html>
    <RootWrapper branding={branding}>
      <Head />
      <Preview>You've been added to a team</Preview>
      <Body className="bg-white">
        <ContentWrapper branding={branding}>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            You've been added to a team
          </Heading>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            <span className="font-bold text-gray-800">{inviterName}</span> (
            {inviterEmail}) has added you to the team{' '}
            <span className="font-bold text-gray-800">{teamTitle}</span>
            {workspaceTitle ? ` in workspace ${workspaceTitle}` : ''} with role{' '}
            <span className="font-bold text-gray-800">{roleLabel}</span>.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">
              Open {resolveProductName(branding)}
            </Text>
          </Button>
        </ContentWrapper>
        <Footer branding={branding} />
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
