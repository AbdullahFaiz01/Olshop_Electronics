import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

console.log("BREVO_API_KEY loaded?", !!process.env.BREVO_API_KEY);
console.log("BREVO_API_KEY length:", process.env.BREVO_API_KEY?.length);
console.log("MAIL_FROM:", process.env.MAIL_FROM);

export default async function sendMail({ to, subject, text }) {
  try {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      throw new Error("BREVO_API_KEY is not set in environment variables");
    }

    const payload = {
      sender: { email: process.env.MAIL_FROM },
      to: [{ email: to }],
      subject,
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