import { ConfidentialClientApplication } from '@azure/msal-node';
import Ticket from '../models/Ticket';

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID as string,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID as string}`,
  },
};

const msalClient = new ConfidentialClientApplication(msalConfig);
let isSyncing = false;

async function getAccessToken() {
  const tokenResponse = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!tokenResponse?.accessToken) {
    throw new Error('Could not acquire Microsoft Graph access token.');
  }
  return tokenResponse.accessToken;
}

// Helper function to dynamically determine category based on subject/content 
function determineCategory(subject = '', body = '') {
  const text = `${subject} ${body}`.toLowerCase();
  
  if (text.includes('urgent') || text.includes('critical') || text.includes('down')) {
    return 'Critical Incident';
  }
  if (text.includes('login') || text.includes('password') || text.includes('access')) {
    return 'Access Control';
  }
  if (text.includes('shipping') || text.includes('dock') || text.includes('logistics')) {
    return 'Logistics Operations';
  }
  
  return process.env.DEFAULT_EMAIL_CATEGORY || 'General Support';
}

export async function processUnreadEmails() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const accessToken = await getAccessToken();
    const email = process.env.OUTLOOK_EMAIL;

    if (!email) {
      console.error('[Email Sync Error] OUTLOOK_EMAIL missing from .env');
      return;
    }

    const graphUrl =
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}` +
      `/mailFolders/inbox/messages` +
      `?$filter=isRead eq false` +
      `&$top=10` +
      `&$select=id,subject,from,receivedDateTime,bodyPreview,isRead` +
      `&$orderby=receivedDateTime desc`;

    const response = await fetch(graphUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      console.error('[Graph API Error Details]:', JSON.stringify(data, null, 2));
      return;
    }

    if (!data.value || data.value.length === 0) {
      return;
    }

    for (const emailMessage of data.value) {
      const senderEmail = emailMessage.from?.emailAddress?.address || 'Unknown';
      const senderName = emailMessage.from?.emailAddress?.name || 'Unknown';

      const rawDescription = emailMessage.bodyPreview || '';
      const cleanDescription = rawDescription
        .replace(/Get Outlook for iOS/gi, '')
        .trim();

      const resolvedIssueType = determineCategory(emailMessage.subject, cleanDescription);

      const existingTicket = await Ticket.findOne({
        outlookMessageId: emailMessage.id,
      });

      if (!existingTicket) {
        const generatedTicketId = emailMessage.id
          ? `INC-${emailMessage.id.substring(emailMessage.id.length - 10)}-${Math.floor(Math.random() * 1000)}`
          : `INC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        await Ticket.create({
          ticketId: generatedTicketId,
          title: emailMessage.subject || 'No Subject',
          subject: emailMessage.subject || 'No Subject',
          description: cleanDescription,
          source: 'Email',
          issueType: resolvedIssueType,
          priority: 'Medium',
          generator: senderName,
          sender: senderName,
          sendEmail: senderEmail,
          senderEmail: senderEmail,
          bodyPreview: cleanDescription,
          receivedDateTime: emailMessage.receivedDateTime,
          status: 'Open',
          companyId: 'openport123',
          outlookMessageId: emailMessage.id,
        });
        console.log(
          `[MongoDB] Unified ticket successfully created for: "${emailMessage.subject}" under category: "${resolvedIssueType}"`,
        );
      }

      const markAsReadUrl =
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}` +
        `/messages/${encodeURIComponent(emailMessage.id)}`;

      await fetch(markAsReadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead: true }),
      });
    }
  } catch (error: any) {
    console.error('[Email Sync Error]:', error.message);
  } finally {
    isSyncing = false;
  }
}

module.exports = { processUnreadEmails, getAccessToken };