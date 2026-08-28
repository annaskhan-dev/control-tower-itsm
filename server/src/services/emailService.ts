import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Ticket } from '../tickets/schemas/ticket.schema';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private isSyncing = false;
  private isAppReady = false;
  
  // Record the exact time this server instance started up. 
  // It will ONLY process emails received *after* this moment, preventing past emails from flooding.
  private readonly serverStartTime = new Date();

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
        `[Email Worker] Initial boot delay passed. Worker is now active (Filtering emails forward from ${this.serverStartTime.toISOString()}).`,
      );
    }, 8000);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCronEmailSync(): Promise<void> {
    if (!this.isAppReady) {
      return; // Skip execution during the startup window
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

      // Format server start time to ISO string for Microsoft Graph OData filter
      const startTimeIso = this.serverStartTime.toISOString();

      const graphUrl =
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}` +
        `/mailFolders/inbox/messages` +
        `?$filter=isRead eq false and receivedDateTime ge ${startTimeIso}` +
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
        this.logger.error(`[Graph API Error Response]: ${JSON.stringify(data)}`);
        return;
      }

      if (!data.value || data.value.length === 0) {
        return;
      }

      this.logger.log(
        `[Email Worker] Found ${data.value.length} new unread email(s) since startup. Processing...`,
      );

      for (const emailMessage of data.value) {
        // 1. Strict Check: If a ticket with this Outlook Message ID already exists, skip it completely!
        const existingTicket = await this.ticketModel.findOne({
          outlookMessageId: emailMessage.id,
        });

        if (existingTicket) {
          this.logger.log(`[Email Worker] Ticket already exists for message ID: ${emailMessage.id}. Skipping.`);
          continue; 
        }

        const senderEmail =
          emailMessage.from?.emailAddress?.address || 'Unknown';
        const senderName = emailMessage.from?.emailAddress?.name || 'Unknown';

        const rawDescription = emailMessage.bodyPreview || '';
        const cleanDescription = rawDescription
          .replace(/Get Outlook for iOS/gi, '')
          .trim();

        try {
          // Use a stable, deterministic ID based on the message ID (no random numbers)
          const shortId = emailMessage.id
            ? emailMessage.id.substring(emailMessage.id.length - 10)
            : Date.now();
          const generatedTicketId = `INC-${shortId}`;

          await (this.ticketModel as any).create({
            ticketId: generatedTicketId,
            title: emailMessage.subject || 'No Subject',
            subject: emailMessage.subject || 'No Subject',
            description: cleanDescription,
            source: 'Email',
            issueType: null,         // Left empty/null for admin/manager configuration
            category: null,          // Left empty/null for admin/manager configuration
            priority: 'Medium',      // Default baseline priority until set by manager
            generator: 'email',      // Explicitly set generator to the literal word 'email'
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
          // Catch race-condition or duplicate key errors safely
          if (dbError.code === 11000) {
            this.logger.log(`[Email Worker] Duplicate message ID caught by DB index: ${emailMessage.id}`);
          } else {
            this.logger.error(`[MongoDB Create Error]: ${dbError.message}`);
          }
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
}