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

interface NudgeSeatLimitProps {
  workspaceTitle: string;
  currentEditors: number;
  editorLimit: number;
  inviteUrl: string;
  upgradeUrl: string;
}

const DOC_ROLES =
  'https://nocodb.com/docs/product-docs/collaboration/workspace-collaboration';

export const NudgeSeatLimit = ({
  workspaceTitle,
  currentEditors,
  editorLimit,
  inviteUrl,
  upgradeUrl,
}: NudgeSeatLimitProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>{`You've used all ${editorLimit} editor seats on ${workspaceTitle}`}</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            You've used all {editorLimit} editor seats
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle} · {currentEditors} / {editorLimit} editors
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Your workspace is on the Free plan, which includes up to{' '}
            {editorLimit} editors. To bring more editors aboard, upgrade your
            plan.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={upgradeUrl}
          >
            <Text className="!my-[8px]">Upgrade plan</Text>
          </Button>
          <Text className="text-gray-600 text-center text-sm !mt-6 !mb-0">
            <strong>
              You can still invite viewers and commenters for free.
            </strong>{' '}
            Viewer and commenter seats don't count toward the editor limit, so
            you can keep growing the team without an upgrade.
          </Text>
          <Section className="text-center pt-2">
            <Link className="text-brand-500 underline text-sm" href={inviteUrl}>
              Invite a viewer or commenter →
            </Link>
          </Section>
          <Text className="text-gray-600 text-center text-xs !mt-6 !mb-0">
            New to roles?{' '}
            <Link className="text-brand-500 underline" href={DOC_ROLES}>
              See what each role can do →
            </Link>
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

NudgeSeatLimit.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  currentEditors: 3,
  editorLimit: 3,
  inviteUrl: 'https://app.nocodb.com/ws_123/settings?tab=members',
  upgradeUrl: 'https://app.nocodb.com/ws_123/settings?tab=billing',
};

export default NudgeSeatLimit;
