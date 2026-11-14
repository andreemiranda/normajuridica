import 'server-only';
import { SITE_CONFIG } from './site-config';

export function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure:
      process.env.SMTP_SECURE === 'true' ||
      (process.env.SMTP_PORT ? process.env.SMTP_PORT === '465' : true),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    receiver:
      process.env.CONTACT_RECEIVER_EMAIL ||
      process.env.SMTP_USER ||
      `contato@${SITE_CONFIG.domain}`,
  };
}

export function getAiSummaryConfig() {
  return {
    endpoint: process.env.AI_SUMMARY_API_ENDPOINT || '',
    apiKey: process.env.AI_SUMMARY_API_KEY || '',
    model: process.env.AI_SUMMARY_MODEL || 'gpt-4o-mini',
  };
}
