import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false, // false for port 587 (uses STARTTLS upgrade)
      requireTLS: true, // Forces STARTTLS security upgrade on port 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Extended timeouts to prevent Port 587 connection drops on Railway
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      tls: {
        // Removed 'ciphers: SSLv3' to allow modern TLS 1.2/1.3 required by AWS
        rejectUnauthorized: false, // Set to false to prevent self-signed/FIPS chain errors in cloud containers
      },
    });
  }

  async sendPrimaryAssigneeChangedEmail(oldAssignee: any, newAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const subject = `Ticket Assignment Updated: #${ticketRef}`;
    
    if (oldAssignee?.email) {
      await this.sendEmail({ 
        to: oldAssignee.email, 
        subject, 
        html: `<div style="font-family: Arial, sans-serif; color: #333;"><p>You have been unassigned from ticket <b>#${ticketRef}</b>.</p></div>` 
      });
    }

    if (newAssignee?.email) {
      await this.sendEmail({ 
        to: newAssignee.email, 
        subject, 
        html: `<div style="font-family: Arial, sans-serif; color: #333;"><p>You have been assigned as primary handler for ticket <b>#${ticketRef}</b>.</p></div>` 
      });
    }
  }

  async sendSubAssigneeAddedEmail(primaryAssignee: any, subAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const subject = `Sub-Assignee Attached: #${ticketRef}`;

    if (primaryAssignee?.email) {
      await this.sendEmail({ 
        to: primaryAssignee.email, 
        subject, 
        html: `<div style="font-family: Arial, sans-serif; color: #333;"><p>Sub-assignee attached to #<b>${ticketRef}</b>.</p></div>` 
      });
    }
    if (subAssignee?.email) {
      await this.sendEmail({ 
        to: subAssignee.email, 
        subject, 
        html: `<div style="font-family: Arial, sans-serif; color: #333;"><p>You are a sub-assignee on #<b>${ticketRef}</b>.</p></div>` 
      });
    }
  }

  async sendBreachEmailToManager(ticket: any) {
    const managerEmail = process.env.MANAGER_EMAIL || process.env.SMTP_USER;
    if (!managerEmail) {
      this.logger.warn('MANAGER_EMAIL is not defined in environment variables. Skipping breach email.');
      return;
    }
    const ticketRef = ticket.ticketId || ticket._id;
    await this.sendEmail({
      to: managerEmail,
      subject: `🚨 SLA BREACH ALERT: Ticket #${ticketRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #d9534f;">SLA Breach Notice</h2>
          <p>Warning: Ticket <b>#${ticketRef}</b> (<b>${ticket.title || 'Untitled'}</b>) has breached its SLA threshold deadline.</p>
          <p>Please review the control tower portal immediately.</p>
        </div>
      `,
    });
  }

  async sendEmail({ to, subject, html }: SendEmailOptions) {
    if (!to) return;
    try {
      const info = await this.transporter.sendMail({
        from: `"OpenPort Control Tower" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`✅ Email sent successfully via AWS SMTP (Port 587): ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`❌ Error sending email via AWS SMTP (Port 587): ${error.message}`, error.stack);
    }
  }
}