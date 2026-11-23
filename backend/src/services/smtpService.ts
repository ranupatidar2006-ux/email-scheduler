import nodemailer from 'nodemailer';
import { query } from '../config/database';

interface EtherealCreds {
  ethereal_user: string;
  ethereal_pass: string;
  smtp_host: string;
  smtp_port: number;
}

// Cache transporters per sender to avoid re-creating them
const transporterCache = new Map<string, nodemailer.Transporter>();

export class SmtpService {
  /**
   * Get or create an Ethereal account for a sender email.
   * Each sender gets their own Ethereal account to simulate multi-sender.
   */
  async getOrCreateEtherealAccount(senderEmail: string): Promise<EtherealCreds> {
    // Check DB first
    const existing = await query(
      `SELECT * FROM ethereal_accounts WHERE sender_email = $1`,
      [senderEmail]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create a new Ethereal account
    const testAccount = await nodemailer.createTestAccount();

    await query(
      `INSERT INTO ethereal_accounts (sender_email, ethereal_user, ethereal_pass, smtp_host, smtp_port)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sender_email) DO NOTHING`,
      [senderEmail, testAccount.user, testAccount.pass, testAccount.smtp.host, testAccount.smtp.port]
    );

    return {
      ethereal_user: testAccount.user,
      ethereal_pass: testAccount.pass,
      smtp_host: testAccount.smtp.host,
      smtp_port: testAccount.smtp.port,
    };
  }

  async getTransporter(senderEmail: string): Promise<nodemailer.Transporter> {
    if (transporterCache.has(senderEmail)) {
      return transporterCache.get(senderEmail)!;
    }

    const creds = await this.getOrCreateEtherealAccount(senderEmail);

    const transporter = nodemailer.createTransport({
      host: creds.smtp_host,
      port: creds.smtp_port,
      secure: false,
      auth: {
        user: creds.ethereal_user,
        pass: creds.ethereal_pass,
      },
    });

    transporterCache.set(senderEmail, transporter);
    return transporter;
  }

  async sendEmail(params: {
    sender_email: string;
    recipient_email: string;
    subject: string;
    body: string;
  }): Promise<{ messageId: string; previewUrl: string | false }> {
    const transporter = await this.getTransporter(params.sender_email);

    const info = await transporter.sendMail({
      from: params.sender_email,
      to: params.recipient_email,
      subject: params.subject,
      html: params.body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log(`Email sent: ${info.messageId} | Preview: ${previewUrl}`);

    return {
      messageId: info.messageId,
      previewUrl,
    };
  }
}

export const smtpService = new SmtpService();
