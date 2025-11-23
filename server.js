import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const app = express();
const PORT = 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose.connect("mongodb+srv://faizrusydi478_db_user:faizrusydi478_db_user@cluster0.fgsvu7u.mongodb.net/?appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "❌ MongoDB error:"));
db.once("open", () => console.log("✅ MongoDB Connected!"));

const uploadsDir = path.join(__dirname, "uploads", "profile");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error("File tidak valid"));
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  photoUrl: { type: String, default: "" }
});
const User = mongoose.model("User", userSchema);

app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "Semua kolom wajib diisi!" });

  if (username.length < 3)
    return res.status(400).json({ message: "Username minimal 3 karakter!" });

  const exist = await User.findOne({ email });
  if (exist)
    return res.status(400).json({ message: "Email sudah terdaftar" });

  await new User({ username, email, password }).save();
  res.json({ message: "Registrasi berhasil!" });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  let user = await User.findOne({ email, password });
  if (!user)
    return res.status(401).json({ message: "Email atau password salah!" });

  if (!user.username || user.username.trim() === "") {
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

const orderSchema = new mongoose.Schema({
  userEmail: String,
  nama: String,
  alamat: String,
  telepon: String,
  items: Array,
  total: Number,
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model("Order", orderSchema);

app.post("/api/orders", async (req, res) => {
  try {
    await new Order(req.body).save();
    res.json({ message: "Pembayaran Berhasil✅" });
  } catch {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

app.get("/api/orders/:email", async (req, res) => {
  try {
    const orders = await Order.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch {
    res.status(500).json({ message: "Terjadi kesalahan saat mengambil data." });
  }
});

app.get("/api/user/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    const orderCount = await Order.countDocuments({ userEmail: user.email });
    res.json({
      username: user.username,
      email: user.email,
      orders: orderCount,
      photoUrl: user.photoUrl
    });
  } catch {
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
});

app.put("/api/user/update", async (req, res) => {
  try {
    const { oldEmail, newUsername, newEmail } = req.body;
    const user = await User.findOne({ email: oldEmail });

    if (!user)
      return res.status(404).json({ message: "User tidak ditemukan" });

    if (newUsername && newUsername.trim().length >= 3)
      user.username = newUsername.trim();

    if (newEmail && newEmail !== oldEmail) {
      const exist = await User.findOne({ email: newEmail });
      if (exist)
        return res.status(400).json({ message: "Email baru sudah dipakai!" });
      user.email = newEmail;
    }

    await user.save();

    res.json({
      message: "Profil berhasil diperbarui!",
      username: user.username,
      email: user.email
    });

  } catch {
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
});

app.post("/api/user/photo", upload.single("photo"), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email diperlukan" });

    if (!req.file)
      return res.status(400).json({ message: "File tidak ditemukan" });

    const user = await User.findOne({ email });
    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const photoUrl = `/uploads/profile/${req.file.filename}`;
    user.photoUrl = photoUrl;
    await user.save();

    res.json({ message: "Upload berhasil", photoUrl });

  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/user/photo", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    if (user.photoUrl) {
      const filePath = path.join(__dirname, "." + user.photoUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    user.photoUrl = "";
    await user.save();

    res.json({ message: "Foto profil berhasil dihapus" });
  } catch {
    res.status(500).json({ message: "Gagal menghapus foto" });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);