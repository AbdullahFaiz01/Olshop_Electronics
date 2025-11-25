import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export default async function sendMail({ to, subject, text }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  await transporter.sendMail({
    from: "ElectroStore <no-reply@electrostore.com>",
    to,
    subject,
    text
  });
}