import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a reusable transporter using Ethereal Email for testing if no real SMTP is provided
const createTransporter = async () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback to Ethereal for testing
  const testAccount = await nodemailer.createTestAccount();
  console.log('📧 Created Ethereal Test Account:', testAccount.user);
  
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

export const sendStatusEmail = async (to: string, subject: string, html: string) => {
  try {
    const transporter = await createTransporter();
    const info = await transporter.sendMail({
      from: '"HarisCo Internal Portal" <no-reply@harisco.com>',
      to,
      subject,
      html,
    });
    console.log('✉️ Email sent: %s', info.messageId);
    if (!process.env.SMTP_HOST) {
      console.log('🔗 Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};
