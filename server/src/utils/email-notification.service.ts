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
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    // If using port 465, secure should be true. If port 587, secure should be false.
    const isSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 587;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // e.g., mwru85p6e7i6.fips.wmjb.mail-manager-smtp.amazonaws.com
      port: port,
      secure: isSecure, 
      requireTLS: !isSecure, // required true for STARTTLS (port 587), false for impxx`licit TLS (port 465)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Fix for cloud container timeouts (fails fast instead of hanging)
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: {
        // Required for AWS FIPS SMTP endpoints to secure the handshake
        rejectUnauthorized: true,
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
    try {
      const info = await this.transporter.sendMail({
        from: `"OpenPort Control Tower" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent successfully: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`Error sending email via AWS SES Mail Manager SMTP: ${error.message}`);
    }
  }
}