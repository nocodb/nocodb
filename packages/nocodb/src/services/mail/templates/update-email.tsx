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

interface UpdateEmailTemplateProps {
  email: string;
}

export const UpdateEmail = ({
  email,
}: UpdateEmailTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Email Updated</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Email Updated To
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {email}
          </Section>

        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

UpdateEmail.PreviewProps = {
  email: 'janedoe@gmail.com',
  link: 'https://nocodb.com',
};

export default UpdateEmail;
