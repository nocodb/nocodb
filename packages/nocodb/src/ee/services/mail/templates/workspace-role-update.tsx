import {
  Body,
  Button,
  Column,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';

interface WorkspaceRoleUpdateTemplateProps {
  workspaceTitle: string;
  oldRole: string;
  newRole: string;
  name: string;
  email: string;
  link: string;
}

export const WorkspaceRoleUpdate = ({
  workspaceTitle,
  oldRole,
  newRole,
  name,
  email,
  link,
}: WorkspaceRoleUpdateTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your Workspace role has been updated</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your workspace role has been updated
          </Heading>
          <Section className="py-6 text-center">
            <span className="font-bold text-gray-900 mx-auto text-base">
              {workspaceTitle}
            </span>
          </Section>
          <Section className="pb-6 text-center">
            <Row>
              <Column className="flex max-w-[210px] mx-auto">
                <Img
                  src={`${NC_EMAIL_ASSETS_BASE_URL}/badges/${oldRole}.png`}
                  alt={oldRole}
                  className="h-7"
                />
                <Img
                  src={`${NC_EMAIL_ASSETS_BASE_URL}/icons/arrow-right.png`}
                  alt="Arrow Right"
                  className="h-5 mt-1 ml-2"
                />
                <Img
                  src={`${NC_EMAIL_ASSETS_BASE_URL}/badges/${newRole}.png`}
                  alt={newRole}
                  className="h-7 ml-2"
                />
              </Column>
            </Row>
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            <span className="font-bold text-gray-800">{name}</span> ({email})
            has updated your access in workspace
            <span className="font-bold text-gray-800"> {workspaceTitle}. </span>
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Go to Workspace</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

WorkspaceRoleUpdate.PreviewProps = {
  workspaceTitle: 'Workspace Title',
  oldRole: 'editor',
  newRole: 'creator',
  name: 'John Doe',
  email: 'john@nocodb.com',
  link: 'https://nocodb.com',
};

export default WorkspaceRoleUpdate;
