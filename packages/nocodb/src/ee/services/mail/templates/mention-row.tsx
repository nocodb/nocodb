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

interface MentionRowTemplateProps {
  name: string;
  email: string;
  link: string;
  baseTitle: string;
}

export const MentionRow = ({
  name,
  email,
  baseTitle,
  link,
}: MentionRowTemplateProps) => (
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
              {baseTitle}
            </span>
          </Section>
          <Text className="text-gray-600 text-center !mb-6 text-sm !mt-0">
            <span className="font-bold text-gray-800">{`${name} `}</span>(
            {email}) has mentioned you in a record in
            <span className="font-semibold text-gray-800"> {baseTitle} </span>
            base.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">View Record</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

MentionRow.PreviewProps = {
  name: 'John Doe',
  email: 'johnsnow@nocodb.com',
  link: 'https://nocodb.com',
  baseTitle: 'Base Title',
};

export default MentionRow;
