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
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false, // false for port 587 (uses STARTTLS upgrade)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Extended timeouts and TLS flags to prevent Port 587 timeout on cloud hosts like Railway
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: true,
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
        html: `<p>You have been unassigned from ticket <b>#${ticketRef}</b>.</p>` 
      });
    }

    if (newAssignee?.email) {
      await this.sendEmail({ 
        to: newAssignee.email, 
        subject, 
        html: `<p>You have been assigned as primary handler for ticket <b>#${ticketRef}</b>.</p>` 
      });
    }
  }

  async sendSubAssigneeAddedEmail(primaryAssignee: any, subAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const subject = `Sub-Assignee Attached: #${ticketRef}`;

    if (primaryAssignee?.email) {
      await this.sendEmail({ to: primaryAssignee.email, subject, html: `<p>Sub-assignee attached to #<b>${ticketRef}</b>.</p>` });
    }
    if (subAssignee?.email) {
      await this.sendEmail({ to: subAssignee.email, subject, html: `<p>You are a sub-assignee on #<b>${ticketRef}</b>.</p>` });
    }
  }

  async sendBreachEmailToManager(ticket: any) {
    const managerEmail = process.env.MANAGER_EMAIL;
    if (!managerEmail) return;
    const ticketRef = ticket.ticketId || ticket._id;
    await this.sendEmail({
      to: managerEmail,
      subject: `🚨 SLA BREACH ALERT: Ticket #${ticketRef}`,
      html: `<p>Ticket #${ticketRef} breached its SLA deadline.</p>`
    });
  }

  async sendEmail({ to, subject, html }: SendEmailOptions) {
    if (!to) return;
    try {
      const info = await this.transporter.sendMail({
        from: `"OpenPort Control Tower" <${process.env.EMAIL_FROM || 'alert@openport.com'}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent successfully via AWS SMTP (Port 587): ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`Error sending email via AWS SMTP (Port 587): ${error.message}`, error.stack);
    }
  }
}