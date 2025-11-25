import sendMail from "./sendMail.js";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  photoUrl: { type: String, default: "" },
  photoPublicId: { type: String, default: "" },
  resetCode: { type: String, default: null },
  resetCodeExpire: { type: Date, default: null }
});

const orderItemSchema = new mongoose.Schema(
  { title: String, qty: Number, price: Number },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userEmail: String,
    nama: String,
    alamat: String,
    telepon: String,
    items: [orderItemSchema],
    total: Number
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Order = mongoose.model("Order", orderSchema);

app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: "Semua kolom wajib diisi!" });
  if (username.length < 3) return res.status(400).json({ message: "Username minimal 3 karakter!" });

  const exist = await User.findOne({ email });
  if (exist) return res.status(400).json({ message: "Email sudah terdaftar" });

  await new User({ username, email, password }).save();
  res.json({ message: "Registrasi berhasil!" });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });

  if (!user) return res.status(401).json({ message: "Email atau password salah!" });

  if (!user.username) {
    user.username = email.split("@")[0];
    await user.save();
  }

  res.json({
    message: "Login berhasil",
    email: user.email,
    username: user.username,
    photoUrl: user.photoUrl
  });
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("REQUEST FORGOT PASSWORD:", email);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email tidak ditemukan" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetCode = code;
    user.resetCodeExpire = Date.now() + 5 * 60 * 1000; // 5 menit
    await user.save();

    await sendMail({
      to: email,
      subject: "Reset Password - ElectroStore",
      text: `Kode reset password Anda adalah: ${code} (berlaku 5 menit)`
    });

    console.log("OTP terkirim ke:", email);

    res.json({ success: true, message: "Kode reset telah dikirim ke email Anda" });
  } catch (err) {
    console.error("ERROR /api/forgot-password:", err);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server saat mengirim email reset password"
    });
  }
});
app.post("/api/verify-reset-code", async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, message: "Email tidak ditemukan" });

  if (user.resetCode !== code)
    return res.status(400).json({ success: false, message: "Kode OTP salah" });

  if (user.resetCodeExpire < Date.now())
    return res.status(400).json({ success: false, message: "Kode OTP telah kadaluarsa" });

  res.json({ success: true, message: "OTP valid" });
});

app.post('/api/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, message: "Email tidak ditemukan" });

  if (user.resetCode !== code)
    return res.status(400).json({ success: false, message: "Kode reset salah" });

  if (user.resetCodeExpire < Date.now())
    return res.status(400).json({ success: false, message: "Kode reset telah kadaluarsa" });

  user.password = newPassword;
  user.resetCode = null;
  user.resetCodeExpire = null;
  await user.save();

  res.json({ success: true, message: "Password berhasil diubah" });
});

app.put("/api/user/update", async (req, res) => {
  const { oldEmail, newUsername, newEmail } = req.body;
  const user = await User.findOne({ email: oldEmail });

  if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

  if (newUsername && newUsername.length >= 3) user.username = newUsername;

  if (newEmail && newEmail !== oldEmail) {
    const exist = await User.findOne({ email: newEmail });
    if (exist) return res.status(400).json({ message: "Email baru sudah dipakai!" });
    user.email = newEmail;
  }

  await user.save();

  res.json({ message: "Profil berhasil diperbarui!", username: user.username, email: user.email });
});

app.get("/api/user/:email", async (req, res) => {
  const user = await User.findOne({ email: req.params.email });
  if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

  const ordersCount = await Order.countDocuments({ userEmail: req.params.email });

  res.json({
    username: user.username,
    email: user.email,
    orders: ordersCount,
    photoUrl: user.photoUrl
  });
});

app.post("/api/user/photo", upload.single("photo"), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email wajib diisi" });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
  if (!req.file) return res.status(400).json({ message: "File foto tidak ditemukan" });

  const stream = cloudinary.uploader.upload_stream({ folder: "profile_photos" }, async (err, result) => {
    if (err) return res.status(500).json({ message: "Upload gagal" });

    user.photoUrl = result.secure_url;
    user.photoPublicId = result.public_id;
    await user.save();

    res.json({ message: "Upload berhasil", photoUrl: result.secure_url });
  });

  stream.end(req.file.buffer);
});

app.delete("/api/user/photo", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

  if (user.photoPublicId) {
    try {
      await cloudinary.uploader.destroy(user.photoPublicId);
    } catch { }
  }

  user.photoUrl = "";
  user.photoPublicId = "";
  await user.save();

  res.json({ message: "Foto profil berhasil dihapus" });
});

app.post("/api/orders", async (req, res) => {
  const { userEmail, nama, alamat, telepon, items, total } = req.body;

  if (!userEmail || !nama || !alamat || !telepon || !items.length)
    return res.status(400).json({ message: "Data pesanan tidak lengkap" });

  const order = new Order({ userEmail, nama, alamat, telepon, items, total });
  await order.save();

  res.json({ message: "Pesanan berhasil dibuat", orderId: order._id });
});

app.get("/api/orders/:email", async (req, res) => {
  const orders = await Order.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
  res.json(orders);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});