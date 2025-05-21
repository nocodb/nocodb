import { XcActionType, XcType } from 'nocodb-sdk';
import SMTPPlugin from './SMTPPlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

// @author <dean@deanlofts.xyz>

const config: XcPluginConfig = {
  builder: SMTPPlugin,
  id: 'smtp',
  title: 'SMTP',
  version: '0.0.5',
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
        label: 'From address',
        placeholder: 'admin@example.com',
        type: XcType.SingleLineText,
        required: true,
        help_text:
          "Enter the e-mail address to be used as the sender (appearing in the 'From' field of sent e-mails).",
      },
      {
        key: 'host',
        label: 'SMTP server',
        placeholder: 'smtp.example.com',
        help_text:
          'Enter the SMTP hostname. If you do not have this information available, contact your email service provider.',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'name',
        label: 'From domain',
        placeholder: 'your-domain.com',
        type: XcType.SingleLineText,
        required: true,
        help_text:
          "Specify the domain name that will be used in the 'From' address (e.g., yourdomain.com). This should match the domain of the 'From' address.",
      },
      {
        key: 'port',
        label: 'SMTP port',
        placeholder: 'Port',
        type: XcType.SingleLineText,
        required: true,
        help_text:
          'Enter the port number used by the SMTP server (e.g., 587 for TLS, 465 for SSL, or 25 for insecure connections).',
      },
      {
        key: 'username',
        label: 'Username',
        placeholder: 'Username',
        type: XcType.SingleLineText,
        required: false,
        help_text:
          'Enter the username to authenticate with the SMTP server. This is usually your email address.',
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
      {
        key: 'secure',
        label: 'Use secure connection',
        placeholder: 'Secure',
        type: XcType.Checkbox,
        required: false,
        help_text:
          'Enable this if your SMTP server requires a secure connection (SSL/TLS).',
      },
      {
        key: 'ignoreTLS',
        label: 'Ignore TLS errors',
        placeholder: 'Ignore TLS',
        type: XcType.Checkbox,
        required: false,
        help_text:
          'Enable this if you want to ignore any TLS errors that may occur during the connection. Enabling this disables STARTTLS even if SMTP servers support it, hence may compromise security.',
      },
      {
        key: 'rejectUnauthorized',
        label: 'Reject unauthorized',
        placeholder: 'Reject unauthorized',
        type: XcType.Checkbox,
        required: false,
        help_text:
          'Disable this to allow connecting to an SMTP server that uses a self‑signed or otherwise invalid TLS certificate.',
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
    docs: [],
  },
};

export default config;
