import {
  Column,
  Container,
  Img,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';
export const Footer = () => {
  return (
    <Container className="px-3">
      <Text className="text-gray-500 m-auto text-sm max-w-[400px] text-center">
        NocoDB is your solution for all your no-code needs. Now on cloud, we
        help organisations maintain critical data with our solutions.
      </Text>
      <Section className="mt-12">
        <Row className="max-w-[100px] m-auto">
          <Column>
            <Link href="https://github.com/nocodb" target="_blank">
              <Img
                alt="Github"
                src={`${NC_EMAIL_ASSETS_BASE_URL}/social/github.png`}
                height={32}
                width={32}
              />
            </Link>
          </Column>
          <Column>
            <Link href="https://twitter.com/nocodb" target="_blank">
              <Img
                alt="X"
                src={`${NC_EMAIL_ASSETS_BASE_URL}/social/x.png`}
                height={32}
                width={32}
              />
            </Link>
          </Column>
          <Column>
            <Link href="https://www.youtube.com/@nocodb" target="_blank">
              <Img
                alt="Youtube"
                height={32}
                width={32}
                src={`${NC_EMAIL_ASSETS_BASE_URL}/social/youtube.png`}
              />
            </Link>
          </Column>
          <Column>
            <Link href="http://discord.nocodb.com/" target="_blank">
              <Img
                alt="Discord"
                src={`${NC_EMAIL_ASSETS_BASE_URL}/social/discord.png`}
                height={32}
                width={32}
              />
            </Link>
          </Column>
          <Column>
            <Link
              href="https://www.linkedin.com/company/nocodb"
              target="_blank"
            >
              <Img
                alt="Linkedin"
                src={`${NC_EMAIL_ASSETS_BASE_URL}/social/linkedin.png`}
                height={32}
                width={32}
              />
            </Link>
          </Column>
        </Row>
      </Section>
      <Section className="mt-6">
        <Row className="max-w-[380px] m-auto">
          <Column className="border pr-1 border-y-0 border-l-0 border-r-1 border-solid border-gray-200">
            <Link href="https://app.nocodb.com/" target="_blank">
              <Text className="text-center underline py-0 !my-0 text-gray-500 text-[13px]">
                Getting Started
              </Text>
            </Link>
          </Column>
          <Column className="border border-y-0 px-1 border-l-0 border-r-1 border-solid border-gray-200">
            <Link href="https://blog.nocodb.com" target="_blank">
              <Text className="text-center underline py-0 !my-0 text-gray-500 text-[13px]">
                Blog
              </Text>
            </Link>
          </Column>
          <Column className="border px-1 border-y-0 border-l-0 border-r-1 border-solid border-gray-200">
            <Link href="https://docs.nocodb.com/" target="_blank">
              <Text className="text-center underline py-0 !my-0 text-gray-500 text-[13px]">
                Docs
              </Text>
            </Link>
          </Column>
          <Column className="pl-1">
            <Link href="https://nocodb.com/terms-of-service" target="_blank">
              <Text className="text-center underline py-0 !my-0 text-gray-500 text-[13px]">
                Terms of Service
              </Text>
            </Link>
          </Column>
        </Row>

        <Row className="mt-6">
          <Column>
            <Text className="text-center !my-0 text-gray-500 text-[13px]">
              {new Date().getFullYear()} — © NocoDB Inc.
            </Text>
          </Column>
        </Row>
        <Row className="mt-6">
          <Column>
            <Text className="text-center !my-0 text-gray-500 text-[13px]">
              All rights reserved.
            </Text>
          </Column>
        </Row>
      </Section>
    </Container>
  );
};
