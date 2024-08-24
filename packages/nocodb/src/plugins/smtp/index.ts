import { XcActionType, XcType } from 'nocodb-sdk';
import SMTPPlugin from './SMTPPlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

// @author <dean@deanlofts.xyz>

const config: XcPluginConfig = {
  builder: SMTPPlugin,
  title: 'SMTP',
  version: '0.0.4',
  // icon: 'mdi-email-outline',
  description: 'SMTP email client',
  price: 'Free',
  tags: 'Email',
  category: 'Email',
  inputs: {
    title: 'Configure Email SMTP',
    items: [
      {
        key: 'from',
        label: 'From Address',
        placeholder: 'admin@run.com',
        type: XcType.SingleLineText,
        required: true,
        help_text:
          'Enter the email address you want to appear as the sender of the emails sent through this SMTP configuration',
      },
      {
        key: 'host',
        label: 'SMTP Server',
        placeholder: 'smtp.run.com',
        help_text:
          'Enter outgoing mail server address (SMTP). If you do not have this information available, contact your email service provider',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'name',
        label: 'From Domain',
        placeholder: 'your-domain.com',
        type: XcType.SingleLineText,
        required: true,
        help_text:
          "Specify the domain name that will be used in the 'From' address (e.g., yourdomain.com). This should match the domain of the From Address.",
      },
      {
        key: 'port',
        label: 'SMTP Port',
        placeholder: 'Port',
        type: XcType.SingleLineText,
        required: true,
        help_text:
          'Enter the port number used by the SMTP server (e.g., 587 for TLS, 465 for SSL, or 25 for non-secure connections).',
      },
      {
        key: 'secure',
        label: 'Use Secure Connection',
        placeholder: 'Secure',
        type: XcType.Checkbox,
        required: false,
        help_text:
          'Enable this on if your SMTP server requires a secure connection (SSL/TLS).',
      },
      {
        key: 'ignoreTLS',
        label: 'Ignore TLS Errors',
        placeholder: 'Ignore TLS',
        type: XcType.Checkbox,
        required: false,
        help_text:
          'Enable this if you want to bypass any TLS errors that may occur during the connection. Only use this if necessary, as it may compromise security.',
      },
      {
        key: 'rejectUnauthorized',
        label: 'Reject Unauthorized',
        placeholder: 'Reject Unauthorized',
        type: XcType.Checkbox,
        required: false,
        help_text:
          'Enable this on to reject emails that fail authentication checks, ensuring only authorized emails are sent.',
      },
      {
        key: 'username',
        label: 'Username',
        placeholder: 'Username',
        type: XcType.SingleLineText,
        required: false,
        help_text:
          'Enter the username required to authenticate with the SMTP server. This is usually your email address.',
      },
      {
        key: 'password',
        label: 'Password',
        placeholder: 'Password',
        type: XcType.Password,
        required: false,
        help_text:
          'Enter the password associated with the SMTP server username. Click the eye icon to view the password as you type',
      },
    ],
    actions: [
      {
        label: 'Test',
        key: 'test',
        actionType: XcActionType.TEST,
        type: XcType.Button,
      },
      {
        label: 'Save',
        key: 'save',
        actionType: XcActionType.SUBMIT,
        type: XcType.Button,
      },
    ],
    msgOnInstall:
      'Successfully installed and email notification will use SMTP configuration',
    msgOnUninstall: '',
  },
};

export default config;
