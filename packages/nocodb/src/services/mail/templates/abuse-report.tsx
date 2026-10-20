import {
  Body,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import type { WhiteLabelConfig } from 'nocodb-sdk';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

interface AbuseReportTemplateProps {
  // All values arrive defanged and truncated — nothing here may render as a link.
  resourceType: string;
  resourceTitle: string;
  workspace: string;
  publicUrl: string;
  reason: string;
  reporter: string;
  description: string;
  reportedAt: string;
  ids: string;
  suppressed?: number;
  branding?: WhiteLabelConfig | null;
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <Row className="mb-3">
    <Column>
      <Text className="text-gray-500 text-xs font-semibold !m-0 uppercase">
        {label}
      </Text>
      <Text
        className="text-gray-900 text-sm !m-0 break-all"
        style={{ whiteSpace: 'pre-wrap' }}
      >
        {value || '—'}
      </Text>
    </Column>
  </Row>
);

export const AbuseReport = ({
  resourceType,
  resourceTitle,
  workspace,
  publicUrl,
  reason,
  reporter,
  description,
  reportedAt,
  ids,
  suppressed,
  branding,
}: AbuseReportTemplateProps) => (
  <Html>
    <RootWrapper branding={branding}>
      <Head />
      <Preview>A public page was reported for abuse</Preview>
      <Body className="bg-white">
        <ContentWrapper branding={branding}>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            A public page was reported for abuse
          </Heading>
          <Text className="text-gray-600 text-center text-sm !mt-2 !mb-6">
            A visitor reported a publicly shared {resourceType}. Review it and
            disable the public link if it is abusive.
          </Text>
          <Section>
            <Field label="Reported page" value={resourceTitle} />
            <Field label="Workspace" value={workspace} />
            <Field label="Public link" value={publicUrl} />
            <Field label="Reason" value={reason} />
            <Field label="Details" value={description} />
            <Field label="Reported by" value={reporter} />
            <Field label="Reported at" value={reportedAt} />
            <Field label="Reference" value={ids} />
          </Section>
          {suppressed ? (
            <Text className="text-gray-900 text-sm !my-4">
              {suppressed} more {suppressed === 1 ? 'report' : 'reports'}{' '}
              arrived while notifications were paused for volume. They are
              stored and not listed here.
            </Text>
          ) : null}
          <Hr />
          <Text className="text-gray-500 text-xs !my-4">
            Links are shown in a non-clickable form ([.] for dots) because the
            reported page may be malicious. Inspect it in a private window, not
            while signed in.
          </Text>
        </ContentWrapper>
        <Footer branding={branding} />
      </Body>
    </RootWrapper>
  </Html>
);

AbuseReport.PreviewProps = {
  resourceType: 'form',
  resourceTitle: 'Account verification',
  workspace: 'Acme (ws_123)',
  publicUrl: 'hxxps://app[.]nocodb[.]com/nc/form/0b7f…',
  reason: 'Phishing / credential harvesting',
  reporter: 'Jane Doe <jane@example.com>',
  description:
    'This form pretends to be a bank login page and asks visitors for their password.',
  reportedAt: '2026-10-08 12:00 UTC',
  ids: 'Report abr_123 · Resource vw_456 · Base p_789',
};

export default AbuseReport;
