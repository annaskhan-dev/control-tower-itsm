const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Universal email sender utility
 */
const sendEmail = async ({ to, subject, html }) => {
  if (!to) return;
  try {
    const info = await transporter.sendMail({
      from: `"OpenPort Control Tower" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });
    console.log("Email sent successfully: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email via AWS SES SMTP:", error);
  }
};

module.exports = { sendEmail };