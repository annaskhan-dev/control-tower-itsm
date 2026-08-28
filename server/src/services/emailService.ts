import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, connection } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Ticket } from '../tickets/schemas/ticket.schema';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private isSyncing = false;
  private isAppReady = false;

  private msalConfig = {
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID as string}`,
    },
  };

  private msalClient = new ConfidentialClientApplication(this.msalConfig);

  constructor(@InjectModel(Ticket.name) private ticketModel: Model<Ticket>) {
    // Give Mongoose 8 seconds to establish stable Atlas connection before allowing cron tasks
    setTimeout(() => {
      this.isAppReady = true;
      this.logger.log(
        '[Email Worker] Initial boot delay passed. Worker is now active.',
      );
    }, 8000);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCronEmailSync(): Promise<void> {
    if (!this.isAppReady) {
      return; // Skip execution during the startup window
    }

    // State 1 means fully connected to MongoDB
    if (connection.readyState !== 1) {
      this.logger.warn(
        `[Email Worker] Skipping sync. DB connection state is: ${connection.readyState}`,
      );
      return;
    }

    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const accessToken = await this.getAccessToken();
      const email = process.env.OUTLOOK_EMAIL;

      if (!email) {
        this.logger.error(
          '[Email Worker] OUTLOOK_EMAIL environment variable is missing.',
        );
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
      
      // DEBUG: Log Graph API response status and details
      this.logger.log(`[Email Worker] Graph API Response Status: ${response.status}`);
      if (!response.ok) {
        this.logger.error(`[Graph API Error Response]: ${JSON.stringify(data)}`);
        return;
      }

      if (!data.value || data.value.length === 0) {
        this.logger.log('[Email Worker] No unread emails found in inbox.');
        return;
      }

      this.logger.log(
        `[Email Worker] Found ${data.value.length} unread email(s). Processing...`,
      );

      for (const emailMessage of data.value) {
        this.logger.log(`[Email Worker] Processing email: "${emailMessage.subject}" (ID: ${emailMessage.id})`);

        const senderEmail =
          emailMessage.from?.emailAddress?.address || 'Unknown';
        const senderName = emailMessage.from?.emailAddress?.name || 'Unknown';

        const rawDescription = emailMessage.bodyPreview || '';
        const cleanDescription = rawDescription
          .replace(/Get Outlook for iOS/gi, '')
          .trim();
        const resolvedIssueType = this.determineCategory(
          emailMessage.subject,
          cleanDescription,
        );

        const existingTicket = await this.ticketModel.findOne({
          outlookMessageId: emailMessage.id,
        });

        if (!existingTicket) {
          try {
            const generatedTicketId = emailMessage.id
              ? `INC-${emailMessage.id.substring(emailMessage.id.length - 10)}-${Math.floor(Math.random() * 1000)}`
              : `INC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

            await (this.ticketModel as any).create({
              ticketId: generatedTicketId,
              title: emailMessage.subject || 'No Subject',
              subject: emailMessage.subject || 'No Subject',
              description: cleanDescription,
              source: 'Email',
              issueType: resolvedIssueType,
              priority: 'Medium',
              generator: senderName,
              sender: senderName,
              senderEmail: senderEmail,
              bodyPreview: cleanDescription,
              receivedDateTime: emailMessage.receivedDateTime,
              status: 'Open',
              companyId: 'openport123',
              outlookMessageId: emailMessage.id,
            });
            this.logger.log(
              `[MongoDB] Ticket successfully created for: "${emailMessage.subject}" from ${senderEmail}`,
            );
          } catch (dbError: any) {
            this.logger.error(`[MongoDB Create Error]: ${dbError.message}`);
          }
        } else {
          this.logger.log(
            `[Email Worker] Ticket already exists for message ID: ${emailMessage.id}`,
          );
        }

        const markAsReadUrl =
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}` +
          `/messages/${encodeURIComponent(emailMessage.id)}`;

        const patchRes = await fetch(markAsReadUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isRead: true }),
        });

        if (!patchRes.ok) {
          const patchErr = await patchRes.json();
          this.logger.error(`[Graph API Patch Error]: ${JSON.stringify(patchErr)}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`[Email Sync Error]: ${error.stack || error.message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  async getAccessToken(): Promise<string> {
    const tokenResponse = await this.msalClient.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });
    if (!tokenResponse?.accessToken) {
      throw new Error('Could not acquire Microsoft Graph access token.');
    }
    return tokenResponse.accessToken;
  }

  private determineCategory(subject = '', body = ''): string {
    const text = `${subject} ${body}`.toLowerCase();
    if (
      text.includes('urgent') ||
      text.includes('critical') ||
      text.includes('down')
    ) {
      return 'Critical Incident';
    }
    if (
      text.includes('login') ||
      text.includes('password') ||
      text.includes('access')
    ) {
      return 'Access Control';
    }
    if (
      text.includes('shipping') ||
      text.includes('dock') ||
      text.includes('logistics')
    ) {
      return 'Logistics Operations';
    }
    return process.env.DEFAULT_EMAIL_CATEGORY || 'General Support';
  }
}