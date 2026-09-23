import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false, // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * 1. Primary Assignee Changed Notification
   */
  async sendPrimaryAssigneeChangedEmail(oldAssignee: any, newAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const subject = `Ticket Assignment Updated: #${ticketRef}`;
    
    // Notify old assignee if they existed
    if (oldAssignee?.email) {
      const htmlOld = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You have been unassigned from ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      await this.sendEmail({ to: oldAssignee.email, subject, html: htmlOld });
    }

    // Notify new assignee if they exist
    if (newAssignee?.email) {
      const htmlNew = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You have been assigned as the primary handler for ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      await this.sendEmail({ to: newAssignee.email, subject, html: htmlNew });
    }
  }

  /**
   * 2. Sub-Assignee Added Notification
   */
  async sendSubAssigneeAddedEmail(primaryAssignee: any, subAssignee: any, ticket: any) {
    const ticketRef = ticket.ticketId || ticket._id;
    const subject = `Sub-Assignee Attached: #${ticketRef}`;

    // Notify primary assignee
    if (primaryAssignee?.email) {
      const htmlPrimary = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>A sub-assignee has been attached to your managed ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      await this.sendEmail({ to: primaryAssignee.email, subject, html: htmlPrimary });
    }

    // Notify the newly added sub-assignee
    if (subAssignee?.email) {
      const htmlSub = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You have been added as a sub-assignee on ticket <b>#${ticketRef}</b> (${ticket.title || 'Untitled'}).</p>
        </div>
      `;
      await this.sendEmail({ to: subAssignee.email, subject, html: htmlSub });
    }
  }

  /**
   * 3. Manager SLA Breach Alert
   */
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

  /**
   * Universal email sender utility
   */
  async sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    if (!to) return;
    try {
      const info = await this.transporter.sendMail({
        from: `"OpenPort Control Tower" <${process.env.EMAIL_FROM}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent successfully: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`Error sending email via AWS SES SMTP: ${error.message}`);
    }
  }
}