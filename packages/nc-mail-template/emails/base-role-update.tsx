import {
  Body,
  Head,
  Heading,
  Html,
  Preview,
  Img,
  Text,
  Button, Section,
} from '@react-email/components';
import * as React from 'react';
import RootWrapper from '../components/RootWrapper';
import { Footer } from '../components/Footer';
import ContentWrapper from '../components/ContentWrapper';
import { baseUrl } from '../utils/constant';

// Corresponding ejs template
interface Props {
  workspaceTitle: string;
  baseTitle: string;
  role: string;
  name: string;
  email: string;
  link: string;
}

export const BaseRoleUpdate = () => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your base role has been updated</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your base role has been updated
          </Heading>
          <Section className="py-6 text-center">
          <span className="font-bold text-gray-900 text-base">
            {'<%= workspaceTitle %>'}
          </span>
            <span className="px-2 text-gray-700">
            /
          </span>
            <span className="font-bold text-gray-900 text-base">
            {'<%= baseTitle %>'}
          </span>
          </Section>
          <Section className="pb-6 text-center">
            <Img
              src={`${baseUrl}/badges/<%= role %>.png`}
              alt="<%= role %>" className="h-7 mx-auto" />
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Your access in
            <span className="font-bold text-gray-800">
              {' <%= baseTitle %>  '}
            </span>
            has been updated to <span className="font-bold text-gray-800">{'<%= role %>'}</span>
            by <span className="font-bold text-gray-800">{'<%= name %>'}</span> ( {'<%= email %>'})
          </Text>
          <Button className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10" href="<%= link %>">
            <Text className="!my-[8px]">
              Go to Base
            </Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>

  </Html>
);
export default BaseRoleUpdate;
