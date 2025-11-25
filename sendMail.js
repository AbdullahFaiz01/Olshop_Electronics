import nodemailer from "nodemailer";

export default async function sendMail({ to, subject, text }) {
  console.log("sendMail() dipanggil ke:", to);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `ElectroStore <${process.env.MAIL_USER}>`,
      to,
      subject,
      text
    });

    console.log("Email terkirim, messageId:", info.messageId);
  } catch (err) {
    console.error("GAGAL KIRIM EMAIL:", err);
    throw err;
  }
}