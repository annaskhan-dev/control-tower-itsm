import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: false, // Must be false for port 587 (STARTTLS)
      requireTLS: true, // Forces TLS upgrade on port 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 20000, // 20 seconds timeout
      greetingTimeout: 20000,
      socketTimeout: 20000,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // Helper method for professional responsive HTML email layout
  private generateTemplate(options: {
    badgeText: string;
    badgeColor: string;
    message: string;
    ticketRef: string;
    ticketTitle: string;
    priority?: string;
    status?: string;
  }) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #333333; }
            .email-wrapper { width: 100%; background-color: #f4f6f8; padding: 40px 0; }
            .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e1e4e8; }
            .email-header { background-color: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
            .email-header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px; }
            .email-body { padding: 32px 24px; }
            .badge { display: inline-block; padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 20px; background-color: ${options.badgeColor}; color: #ffffff; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
            .message-text { font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px; }
            .ticket-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px; }
            .ticket-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .ticket-row:last-child { margin-bottom: 0; }
            .label { font-weight: 600; color: #64748b; }
            .value { color: #0f172a; font-weight: 500; }
            .footer { background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="email-header">
                <h1>Control Tower ITSM</h1>
              </div>
              <div class="email-body">
                <div class="badge">${options.badgeText}</div>
                <p class="message-text">${options.message}</p>
                
                <div class="ticket-card">
                  <div class="ticket-row"><span class="label">Ticket Ref:</span> <span class="value">#${options.ticketRef}</span></div>
                  <div class="ticket-row"><span class="label">Title:</span> <span class="value">${options.ticketTitle}</span></div>
                  <div class="ticket-row"><span class="label">Priority:</span> <span class="value">${options.priority || 'N/A'}</span></div>
                  <div class="ticket-row"><span class="label">Status:</span> <span class="value">${options.status || 'Active'}</span></div>
                </div>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} OpenPort Control Tower ITSM. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Scenario 0: Ticket Created & Assigned (sent to the initial assignee)
  async sendTicketCreatedEmail(assignee: any, ticket: any) {
    if (!assignee?.email) return;

    const ticketRef = ticket.ticketId || ticket._id;
    const ticketTitle = ticket.title || 'Untitled';
    const priority = ticket.priority;
    const status = ticket.status;
    const subject = `New Ticket Assigned: #${ticketRef}`;

    const html = this.generateTemplate({
      badgeText: 'New Ticket Created',
      badgeColor: '#2563eb', // Blue
      message: `A new ticket <b>#${ticketRef}</b> has been created and assigned to you as the primary handler.`,
      ticketRef,
      ticketTitle,
      priority,
      status,
    });

    await this.sendEmail({ to: assignee.email, subject, html });
  }

  // Scenario 1: Primary Assignee Changed (Consolidated into smart single-dispatch or clear targeting)
  async sendPrimaryAssigneeChangedEmail(oldAssignee: any, newAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const ticketTitle = ticket.title || 'Untitled';
    const priority = ticket.priority;
    const status = ticket.status;
    const subject = `Ticket Assignment Updated: #${ticketRef}`;

    // 1. If someone was unassigned and nobody replaced them (Pure Unassignment)
    if (oldAssignee?.email && (!newAssignee || !newAssignee.email)) {
      const htmlOld = this.generateTemplate({
        badgeText: 'Ticket Unassigned',
        badgeColor: '#d97706', // Orange
        message: `You have been unassigned from ticket <b>#${ticketRef}</b>.`,
        ticketRef,
        ticketTitle,
        priority,
        status,
      });
      await this.sendEmail({ to: oldAssignee.email, subject, html: htmlOld });
      return;
    }

    // 2. If someone was newly assigned and nobody was there before (Pure New Assignment)
    if ((!oldAssignee || !oldAssignee.email) && newAssignee?.email) {
      const htmlNew = this.generateTemplate({
        badgeText: 'New Ticket Assigned',
        badgeColor: '#2563eb', // Blue
        message: `You have been assigned as the primary handler for ticket <b>#${ticketRef}</b>.`,
        ticketRef,
        ticketTitle,
        priority,
        status,
      });
      await this.sendEmail({ to: newAssignee.email, subject, html: htmlNew });
      return;
    }

    // 3. If both exist, check if it's the exact same person
    const sameEmail = oldAssignee?.email && newAssignee?.email && oldAssignee.email === newAssignee.email;
    if (sameEmail) {
      const htmlSingle = this.generateTemplate({
        badgeText: 'Assignment Updated',
        badgeColor: '#2563eb',
        message: `Your assignment status for ticket <b>#${ticketRef}</b> has been refreshed.`,
        ticketRef,
        ticketTitle,
        priority,
        status,
      });
      await this.sendEmail({ to: newAssignee.email, subject, html: htmlSingle });
      return;
    }

    // 4. TRANSFER / REASSIGNMENT CASE (Person A -> Person B):
    // Instead of emailing both and causing inbox clutter, send a targeted notification to the NEW assignee,
    // or handle them cleanly. If you specifically need both notified, you can keep separate calls, 
    // but to prevent duplicate "system noise", send a single clear notice to each party:
    if (oldAssignee?.email) {
      const htmlOld = this.generateTemplate({
        badgeText: 'Ticket Reassigned',
        badgeColor: '#d97706',
        message: `Ticket <b>#${ticketRef}</b> has been reassigned to another handler.`,
        ticketRef,
        ticketTitle,
        priority,
        status,
      });
      await this.sendEmail({ to: oldAssignee.email, subject, html: htmlOld });
    }

    if (newAssignee?.email) {
      const htmlNew = this.generateTemplate({
        badgeText: 'New Assignment',
        badgeColor: '#2563eb',
        message: `You have been assigned as the primary handler for ticket <b>#${ticketRef}</b> (reassigned).`,
        ticketRef,
        ticketTitle,
        priority,
        status,
      });
      await this.sendEmail({ to: newAssignee.email, subject, html: htmlNew });
    }
  }

  // Scenario 2: Sub-Assignee Added (sent to both primary assignee and new sub-assignee)
  async sendSubAssigneeAddedEmail(primaryAssignee: any, subAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const ticketTitle = ticket.title || 'Untitled';
    const priority = ticket.priority;
    const status = ticket.status;
    const subject = `Sub-Assignee Attached: #${ticketRef}`;

    // Notification to Primary Assignee
    if (primaryAssignee?.email) {
      const htmlPrimary = this.generateTemplate({
        badgeText: 'Collaborator Attached',
        badgeColor: '#059669', // Green
        message: `A sub-assignee has been attached to your managed ticket <b>#${ticketRef}</b> to help handle it.`,
        ticketRef,
        ticketTitle,
        priority,
        status,
      });
      await this.sendEmail({ to: primaryAssignee.email, subject, html: htmlPrimary });
    }

    // Notification to New Sub-Assignee
    if (subAssignee?.email) {
      const htmlSub = this.generateTemplate({
        badgeText: 'Sub-Assignee Role',
        badgeColor: '#059669', // Green
        message: `You have been added as a sub-assignee on ticket <b>#${ticketRef}</b>.`,
        ticketRef,
        ticketTitle,
        priority,
        status,
      });
      await this.sendEmail({ to: subAssignee.email, subject, html: htmlSub });
    }
  }

  // Scenario 3: Ticket Breached (sent to manager)
  async sendBreachEmailToManager(ticket: any) {
    const managerEmail = process.env.MANAGER_EMAIL;
    if (!managerEmail) {
      this.logger.warn('MANAGER_EMAIL is not defined in environment variables. Skipping breach notification email.');
      return;
    }

    const ticketRef = ticket.ticketId || ticket._id;
    const ticketTitle = ticket.title || 'Untitled';
    const priority = ticket.priority;
    const status = ticket.status;
    const subject = `🚨 SLA BREACH ALERT: Ticket #${ticketRef}`;

    const html = this.generateTemplate({
      badgeText: 'SLA Breached',
      badgeColor: '#dc2626', // Red
      message: `Warning: Ticket <b>#${ticketRef}</b> has breached its SLA threshold deadline. Please review the control tower portal immediately.`,
      ticketRef,
      ticketTitle,
      priority,
      status,
    });

    await this.sendEmail({ to: managerEmail, subject, html });
  }

  // Core email delivery utility with professional "From" header
  async sendEmail({ to, subject, html }: MailOptions) {
    if (!to) {
      this.logger.warn('Skipped email: "to" address is empty or undefined.');
      return;
    }

    const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'alert@openport.com';

    try {
      const info = await this.transporter.sendMail({
        from: `"Control Tower ITSM" <${senderEmail}>`,
        to: to,
        subject: subject,
        html: html,
      });

      this.logger.log(`✅ Professional email sent successfully to ${to} via SMTP! MessageId: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`❌ Error sending email via SMTP: ${error.message}`, error.stack);
    }
  }
}