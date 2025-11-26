import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export default async function sendMail({ to, subject, text }) {
  try {
    const apiKey = process.env.BREVO_API_KEY;

    const payload = {
      sender: { email: process.env.MAIL_FROM },
      to: [{ email: to }],
      subject: subject,
      textContent: text
    };

    await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json"
      }
    });

    console.log("📧 Email terkirim ke:", to);
    return true;

  } catch (err) {
    console.error("❌ BREVO ERROR:", err.response?.data || err.message);
    return false;
  }
}