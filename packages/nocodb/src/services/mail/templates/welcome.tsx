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

interface WelcomeTemplateProps {
  email: string;
  link: string;
}

export const Welcome = ({ email, link }: WelcomeTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Welcome to NocoDB!</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Welcome to NocoDB!
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {email}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            We're thrilled to have you on board! 🚀 Turn your databases into
            powerful smart tables and manage your data the way you want — no
            code required.
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Get started by creating your first project or exploring templates to
            see what’s possible.
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Need help? Our docs and community are just a click away.
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Let’s build something amazing together! 💡
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Go to your Workspace</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

Welcome.PreviewProps = {
  email: 'janedoe@nocodb.com',
  link: 'https://nocodb.com',
};

export default Welcome;
