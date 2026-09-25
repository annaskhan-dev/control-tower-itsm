import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false, // false for port 587 (STARTTLS)
      requireTLS: true, // forces STARTTLS upgrade for port 587 security
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Essential safeguards against cloud container connection timeouts on Railway
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false, // prevents strict handshake failures with cloud endpoints
      },
    });
  }

  async sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    if (!to) {
      this.logger.warn(`Skipped sendEmail: 'to' address is empty.`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: `"OpenPort Control Tower" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`✅ Email sent successfully: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`❌ Error sending email via AWS SES SMTP: ${error.message}`, error.stack);
    }
  }
}