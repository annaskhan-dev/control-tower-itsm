import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const port = Number(process.env.SMTP_PORT) || 587;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: false, // false for port 587 (uses STARTTLS upgrade)
      requireTLS: true, // force STARTTLS upgrade for port 587 security
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Safeguards against cloud container connection timeouts on Railway
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false, // avoids strict handshake verification errors in cloud environments
      },
    });
  }

  async sendEmail(to: string, subject: string, htmlBody: string) {
    if (!to) return;
    try {
      const senderEmail = process.env.EMAIL_FROM || 'alert@openport.com';

      const info = await this.transporter.sendMail({
        from: `"Control Tower ITSM" <${senderEmail}>`,
        to: to, // The registered user's email address
        subject: subject,
        html: htmlBody,
      });

      this.logger.log(`Email sent successfully to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      this.logger.error(`Error sending email via SMTP: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Helper function for assignee changes
  async sendPrimaryAssigneeChangedEmail(userEmail: string, ticketId: string, assigneeName: string) {
    const subject = `Ticket Assigned: ${ticketId}`;
    const body = `
      <h3>Hello,</h3>
      <p>You have been assigned as the primary assignee for ticket <b>${ticketId}</b>.</p>
      <p>Assigned to: <b>${assigneeName}</b></p>
      <br/>
      <p>Best regards,<br/>Control Tower ITSM Team</p>
    `;
    return this.sendEmail(userEmail, subject, body);
  }

  // Added helper function for SLA breaches
  async sendBreachEmailToManager(ticket: any) {
    try {
      const managerEmail = process.env.MANAGER_DEFAULT_EMAIL || process.env.SMTP_USER;
      if (!managerEmail) {
        this.logger.warn(`[Email Service] Skipped breach email: No manager email or SMTP user defined.`);
        return;
      }

      const ticketIdentifier = ticket.ticketId || ticket._id;
      const subject = `[Control Tower] SLA Breached: Ticket #${ticketIdentifier}`;
      const htmlBody = `
        <h3>SLA Breach Alert</h3>
        <p>The ticket <b>${ticket.title || 'Untitled'}</b> (ID: ${ticketIdentifier}) has breached its SLA deadline.</p>
        <p><b>Priority:</b> ${ticket.priority || 'Medium'}</p>
        <p><b>Assignee:</b> ${ticket.assignee || 'Unassigned'}</p>
        <p><b>Category:</b> ${ticket.category || 'N/A'}</p>
        <br/>
        <p>Please review this ticket immediately in the Control Tower dashboard.</p>
        <p>Best regards,<br/>Control Tower ITSM Team</p>
      `;

      return await this.sendEmail(managerEmail, subject, htmlBody);
    } catch (error: any) {
      this.logger.error(`[Email Service Error] Failed to send breach email: ${error.message}`, error.stack);
    }
  }
}