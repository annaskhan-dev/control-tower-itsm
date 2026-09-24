import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private sesClient: SESClient;

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || process.env.AWS_SES_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.SMTP_USER || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.SMTP_PASS || '',
      },
    });
  }

  async sendPrimaryAssigneeChangedEmail(oldAssignee: any, newAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const subject = `Ticket Assignment Updated: #${ticketRef}`;
    
    this.logger.log(`[EmailDebug] sendPrimaryAssigneeChangedEmail triggered for ticket #${ticketRef}`);
    this.logger.log(`[EmailDebug] oldAssignee data: ${JSON.stringify(oldAssignee)}`);
    this.logger.log(`[EmailDebug] newAssignee data: ${JSON.stringify(newAssignee)}`);

    if (oldAssignee?.email) {
      const htmlOld = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You have been unassigned from ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      const textOld = `You have been unassigned from ticket #${ticketRef} (${ticket.title || 'Untitled'}).`;
      await this.sendEmail({ to: oldAssignee.email, subject, html: htmlOld, text: textOld });
    } else {
      this.logger.warn(`[EmailDebug] Skipped oldAssignee email: Missing email property.`);
    }

    if (newAssignee?.email) {
      const htmlNew = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You have been assigned as the primary handler for ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      const textNew = `You have been assigned as the primary handler for ticket #${ticketRef} (${ticket.title || 'Untitled'}).`;
      await this.sendEmail({ to: newAssignee.email, subject, html: htmlNew, text: textNew });
    } else {
      this.logger.warn(`[EmailDebug] Skipped newAssignee email: Missing email property.`);
    }
  }

  async sendSubAssigneeAddedEmail(primaryAssignee: any, subAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const subject = `Sub-Assignee Attached: #${ticketRef}`;

    this.logger.log(`[EmailDebug] sendSubAssigneeAddedEmail triggered for ticket #${ticketRef}`);

    if (primaryAssignee?.email) {
      const htmlPrimary = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>A sub-assignee has been attached to your managed ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      const textPrimary = `A sub-assignee has been attached to your managed ticket #${ticketRef} (${ticket.title || 'Untitled'}).`;
      await this.sendEmail({ to: primaryAssignee.email, subject, html: htmlPrimary, text: textPrimary });
    }

    if (subAssignee?.email) {
      const htmlSub = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You have been added as a sub-assignee on ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      const textSub = `You have been added as a sub-assignee on ticket #${ticketRef} (${ticket.title || 'Untitled'}).`;
      await this.sendEmail({ to: subAssignee.email, subject, html: htmlSub, text: textSub });
    }
  }

  async sendBreachEmailToManager(ticket: any) {
    const managerEmail = process.env.MANAGER_EMAIL;
    if (!managerEmail) {
      this.logger.warn('[EmailDebug] MANAGER_EMAIL is not defined in environment variables. Skipping breach notification email.');
      return;
    }

    const ticketRef = ticket.ticketId || ticket._id;
    const subject = `🚨 SLA BREACH ALERT: Ticket #${ticketRef}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #d9534f;">SLA Breach Notice</h2>
        <p>Warning: Ticket <b>#${ticketRef}</b> (<b>${ticket.title || 'Untitled'}</b>) has breached its SLA threshold deadline.</p>
        <p>Please review the control tower portal immediately.</p>
      </div>
    `;
    const text = `SLA Breach Notice: Ticket #${ticketRef} (${ticket.title || 'Untitled'}) has breached its SLA threshold deadline. Please review the control tower portal immediately.`;

    await this.sendEmail({ to: managerEmail, subject, html, text });
  }

  async sendEmail({ to, subject, html, text }: MailOptions) {
    this.logger.log(`[EmailDebug] sendEmail invoked for target recipient: ${to}`);

    if (!to) {
      this.logger.warn(`[EmailDebug] Aborted sendEmail: 'to' address is empty or undefined.`);
      return;
    }
    
    const senderEmail = process.env.EMAIL_FROM || process.env.AWS_SES_FROM_EMAIL || process.env.SES_FROM_ADDRESS || process.env.SMTP_USER;
    
    if (!senderEmail) {
      this.logger.error(`[EmailDebug] Aborted sendEmail: No sender email configured (check EMAIL_FROM, AWS_SES_FROM_EMAIL, or SES_FROM_ADDRESS).`);
      return;
    }

    this.logger.log(`[EmailDebug] Preparing AWS SES request. Sender: [${senderEmail}] -> Recipient: [${to}]`);

    try {
      const command = new SendEmailCommand({
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
            ...(text && {
              Text: {
                Data: text,
                Charset: 'UTF-8',
              },
            }),
          },
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
        },
        Source: senderEmail,
      });

      const response = await this.sesClient.send(command);
      this.logger.log(`✅ [EmailDebug] Email sent successfully via AWS SES API! MessageId: ${response.MessageId}`);
    } catch (error: any) {
      // Enhanced logging block to surface full stack trace and AWS metadata
      this.logger.error(`❌ [EmailDebug] Error sending email via AWS SES API: ${error.message}`, error.stack);
      if (error.$metadata) {
        this.logger.error(`[EmailDebug] AWS Error Metadata: ${JSON.stringify(error.$metadata)}`);
      }
    }
  }
}