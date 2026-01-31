import {
  Body,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { RelationTypes, UITypes } from 'nocodb-sdk';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
  getFieldIconUrl,
} from '~/services/mail/templates/components';
import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';

interface SendRecordTemplateProps {
  senderName: string;
  senderEmail: string;
  tableTitle: string;
  baseTitle: string;
  message?: string;
  recordData: Array<{
    parsedValue?: any;
    columnTitle: string;
    uidt: UITypes | string;
    relationType?: RelationTypes;
  }>;
  recordUrl?: string;
}

const SendRecord = ({
  senderName,
  senderEmail,
  tableTitle,
  baseTitle,
  message,
  recordData,
  recordUrl,
}: SendRecordTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>
        {senderName} shared a record from {tableTitle}
      </Preview>
      <Body className="bg-white">
        <ContentWrapper disableContainerPadding>
          <Section className="p-6 mx-auto">
            <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
              {senderName} shared a record with you
            </Heading>

            <Section
              align="center"
              className="my-6"
              style={{ textAlign: 'center', lineHeight: '28px' }}
            >
              <table
                cellPadding="0"
                cellSpacing="0"
                style={{ display: 'inline-block', verticalAlign: 'middle' }}
              >
                <tr>
                  <td style={{ paddingRight: '8px', verticalAlign: 'middle' }}>
                    <Img
                      src={`${NC_EMAIL_ASSETS_BASE_URL}/icons/table.png`}
                      alt="Table Icon"
                      height={24}
                      width={24}
                      className="!h-6 inline-block"
                      style={{ verticalAlign: 'middle' }}
                    />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <span
                      className="text-base font-bold mt-0.5 text-gray-900"
                      style={{
                        verticalAlign: 'middle',
                        display: 'inline-block',
                        lineHeight: '28px',
                      }}
                    >
                      {tableTitle}
                    </span>
                  </td>
                </tr>
              </table>
            </Section>

            <Text className="text-center font-weight-thin text-gray-600 !my-0">
              <span className="font-bold text-gray-800">{senderName}</span> (
              {senderEmail}) has shared a record from
              <span className="font-bold text-gray-800"> {tableTitle} </span>
              in
              <span className="font-bold text-gray-800"> {baseTitle}</span>.
            </Text>

            {message && (
              <Section className="mt-6 p-4 bg-gray-50 rounded-lg">
                <Text className="text-gray-700 !my-0 italic">"{message}"</Text>
              </Section>
            )}
          </Section>

          <Hr />

          <Section className="p-6 mx-auto">
            <Text className="text-lg font-bold text-center !my-0">
              Record Details
            </Text>
            <Section>
              {recordData.map((field) => (
                <Section className="mt-6" key={field.columnTitle}>
                  <Row>
                    <Column className="flex align-middle items-center">
                      <Img
                        className="align-middle"
                        width={16}
                        height={16}
                        src={getFieldIconUrl(field.uidt, field.relationType)}
                      />
                      <Section className="!ml-2 truncate inline-block text-[13px] !my-0 !mr-0 leading-4.5 text-gray-600 align-middle">
                        {field.columnTitle}
                      </Section>
                    </Column>
                  </Row>
                  <Row
                    className="px-4 py-2 border border-1 mt-2 border-solid rounded-lg border-gray-200"
                    style={{
                      boxShadow: `0px 0px 4px 0px rgba(0, 0, 0, 0.08)`,
                    }}
                  >
                    <Column>
                      <Text className="text-gray-800 max-w-xs truncate !my-0">
                        {field.parsedValue || '-'}
                      </Text>
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>

            {recordUrl && (
              <Section className="mt-8 text-center">
                <a
                  href={recordUrl}
                  className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg no-underline"
                  style={{
                    backgroundColor: '#3366FF',
                    color: '#ffffff',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                  }}
                >
                  View Record in NocoDB
                </a>
              </Section>
            )}
          </Section>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

SendRecord.PreviewProps = {
  senderName: 'John Doe',
  senderEmail: 'john@example.com',
  tableTitle: 'Contacts',
  baseTitle: 'My Base',
  message: "Here's the contact information you requested.",
  recordData: [
    {
      parsedValue: 'Jane Smith',
      uidt: UITypes.SingleLineText,
      columnTitle: 'Name',
    },
    {
      parsedValue: 'jane@example.com',
      uidt: UITypes.Email,
      columnTitle: 'Email',
    },
    {
      parsedValue: '+1 234 567 8900',
      uidt: UITypes.PhoneNumber,
      columnTitle: 'Phone',
    },
  ],
  recordUrl: 'https://app.nocodb.com/#/workspace/base/table?rowId=123',
};

export default SendRecord;
