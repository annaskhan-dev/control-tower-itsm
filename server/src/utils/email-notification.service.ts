import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
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
    
    if (oldAssignee?.email) {
      const htmlOld = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You have been unassigned from ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      await this.sendEmail({ to: oldAssignee.email, subject, html: htmlOld });
    }

    if (newAssignee?.email) {
      const htmlNew = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You have been assigned as the primary handler for ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      await this.sendEmail({ to: newAssignee.email, subject, html: htmlNew });
    }
  }

  async sendSubAssigneeAddedEmail(primaryAssignee: any, subAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const subject = `Sub-Assignee Attached: #${ticketRef}`;

    if (primaryAssignee?.email) {
      const htmlPrimary = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>A sub-assignee has been attached to your managed ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      await this.sendEmail({ to: primaryAssignee.email, subject, html: htmlPrimary });
    }

    if (subAssignee?.email) {
      const htmlSub = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You have been added as a sub-assignee on ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      await this.sendEmail({ to: subAssignee.email, subject, html: htmlSub });
    }
  }

  async sendBreachEmailToManager(ticket: any) {
    const managerEmail = process.env.MANAGER_EMAIL;
    if (!managerEmail) {
      this.logger.warn('MANAGER_EMAIL is not defined in environment variables. Skipping breach notification email.');
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

    await this.sendEmail({ to: managerEmail, subject, html });
  }

  async sendEmail({ to, subject, html }: MailOptions) {
    if (!to) return;
    
    const senderEmail = process.env.EMAIL_FROM || process.env.AWS_SES_FROM_EMAIL || process.env.SMTP_USER;
    
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
          },
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
        },
        Source: senderEmail,
      });

      const response = await this.sesClient.send(command);
      this.logger.log(`Email sent successfully via AWS SES API: ${response.MessageId}`);
    } catch (error: any) {
      this.logger.error(`Error sending email via AWS SES API: ${error.message}`);
    }
  }
}