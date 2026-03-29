import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomBytes } from "crypto";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = randomBytes(16).toString("hex");
    cb(null, `${name}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed. Supported: PDF, images, Word docs, text files."));
    }
  },
});

router.post("/", requireAuth, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const host = req.headers.host || "localhost:8080";
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const fileUrl = `${protocol}://${host}/api/uploads/${req.file.filename}`;

    res.json({
      url: fileUrl,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    req.log.error({ err }, "File upload error");
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
