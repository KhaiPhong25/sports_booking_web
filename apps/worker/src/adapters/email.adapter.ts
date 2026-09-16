import nodemailer, { Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

export class NodemailerEmailAdapter implements EmailAdapter {
  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

  static fromEnvironment(): NodemailerEmailAdapter {
    return new NodemailerEmailAdapter(
      nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT ?? 1025),
        secure: false,
      }),
      process.env.MAIL_FROM ?? "Sports Center <no-reply@sports.local>",
    );
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
