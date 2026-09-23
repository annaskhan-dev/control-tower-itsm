import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    if (!to) return;
    try {
      const info = await this.transporter.sendMail({
        from: `"OpenPort Control Tower" <${process.env.EMAIL_FROM || 'raiseaticket@openport.com'}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent successfully: ${info.messageId}`);
    } catch (error) {
      this.logger.error('Error sending email via AWS SES SMTP:', error);
    }
  }
}