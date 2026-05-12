import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Link,
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

interface NudgeInviteTeamProps {
  workspaceTitle: string;
  inviteUrl: string;
}

const DOC_COLLAB =
  'https://nocodb.com/docs/product-docs/collaboration/workspace-collaboration';

export const NudgeInviteTeam = ({
  workspaceTitle,
  inviteUrl,
}: NudgeInviteTeamProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>NocoDB is built for teams — invite yours</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Invite your team to {workspaceTitle}
          </Heading>
          <Section className="py-6 mx-auto text-center text-gray-600 text-sm">
            Workspaces with teammates get more done. Roles let you give
            different people the right access — owner, creator, editor,
            commenter, or viewer.
          </Section>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={inviteUrl}
          >
            <Text className="!my-[8px]">Invite teammates</Text>
          </Button>
          <Text className="text-gray-600 text-center text-xs !mt-6 !mb-0">
            New to roles &amp; sharing?{' '}
            <Link className="text-brand-500 underline" href={DOC_COLLAB}>
              Read the collaboration guide →
            </Link>
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

NudgeInviteTeam.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  inviteUrl: 'https://app.nocodb.com/ws_123/settings?tab=members',
};

export default NudgeInviteTeam;
