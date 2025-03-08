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

interface MentionCommentTemplateProps {
  name: string;
  email: string;
  link: string;
  workspaceTitle: string;
  baseTitle: string;
}

export const MentionComment = ({
  name,
  email,
  link,
  baseTitle,
  workspaceTitle,
}: MentionCommentTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>You have been mentioned</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            You have been mentioned
          </Heading>
          <Section className="py-6 text-center">
            <span className="font-bold text-gray-900 text-base">
              {workspaceTitle}
            </span>
            <span className="px-2 text-gray-700">/</span>
            <span className="font-bold text-gray-900 text-base">
              {baseTitle}
            </span>
          </Section>
          <Text className="text-gray-600 text-center text-sm !mb-6 !mt-0">
            {name} ({email}) has mentioned you in
            <span className="font-semibold text-gray-800"> {baseTitle}</span>
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">View Comment</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

MentionComment.PreviewProps = {
  name: 'John Doe',
  email: 'john@nocodb.com',
  link: 'https://nocodb.com',
  workspaceTitle: 'Workspace Title',
  baseTitle: 'Base Title',
};

export default MentionComment;
