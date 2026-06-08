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

interface WorkspaceTeamRoleUpdateTemplateProps {
  teamTitle: string;
  workspaceTitle: string;
  updaterName: string;
  updaterEmail: string;
  oldRoleLabel: string;
  newRoleLabel: string;
  link: string;
  branding?: WhiteLabelConfig | null;
}

export const WorkspaceTeamRoleUpdate = ({
  teamTitle,
  workspaceTitle,
  updaterName,
  updaterEmail,
  oldRoleLabel,
  newRoleLabel,
  link,
  branding,
}: WorkspaceTeamRoleUpdateTemplateProps) => (
  <Html>
    <RootWrapper branding={branding}>
      <Head />
      <Preview>Your team's workspace role has been updated</Preview>
      <Body className="bg-white">
        <ContentWrapper branding={branding}>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your team's workspace role has been updated
          </Heading>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            <span className="font-bold text-gray-800">{updaterName}</span> (
            {updaterEmail}) has updated your team{' '}
            <span className="font-bold text-gray-800">{teamTitle}</span> role in
            workspace{' '}
            <span className="font-bold text-gray-800">{workspaceTitle}</span>{' '}
            from <span className="font-bold text-gray-800">{oldRoleLabel}</span>{' '}
            to <span className="font-bold text-gray-800">{newRoleLabel}</span>.
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

WorkspaceTeamRoleUpdate.PreviewProps = {
  teamTitle: 'Team Name',
  workspaceTitle: 'Workspace Name',
  updaterName: 'John Doe',
  updaterEmail: 'johndoe@nocodb.com',
  oldRoleLabel: 'Viewer',
  newRoleLabel: 'Editor',
  link: 'https://app.nocodb.com',
};

export default WorkspaceTeamRoleUpdate;
