import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
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

app.put("/api/user/update", async (req, res) => {
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
});

app.get("/api/user/:email", async (req, res) => {
  const user = await User.findOne({ email: req.params.email });
  if (!user)
    return res.status(404).json({ message: "User tidak ditemukan" });

  res.json({
    username: user.username,
    email: user.email,
    orders: 0,
    photoUrl: user.photoUrl
  });
});

app.post("/api/user/photo", upload.single("photo"), async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ message: "User tidak ditemukan" });

    const uploaded = await cloudinary.uploader.upload_stream(
      { folder: "profile_photos" },
      async (error, result) => {
        if (error) return res.status(500).json({ message: "Upload gagal" });

        user.photoUrl = result.secure_url;
        await user.save();

        res.json({
          message: "Upload berhasil",
          photoUrl: result.secure_url
        });
      }
    );

    uploaded.end(req.file.buffer);

  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/user/photo", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ message: "User tidak ditemukan" });

    if (user.photoUrl) {
      const publicId = user.photoUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy("profile_photos/" + publicId);
    }

    user.photoUrl = "";
    await user.save();

    res.json({ message: "Foto profil berhasil dihapus" });

  } catch {
    res.status(500).json({ message: "Gagal menghapus foto" });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);