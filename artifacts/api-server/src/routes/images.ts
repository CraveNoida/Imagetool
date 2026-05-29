import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
const RESULTS_DIR = path.resolve(__dirname, "../../results");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, _file, cb) => {
    const unique = crypto.randomBytes(12).toString("hex");
    const rawExt = _file.originalname.split(".").pop()?.toLowerCase() ?? "jpg";
    const ext = rawExt === "jpg" ? "jpg" : rawExt;
    cb(null, `${unique}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPG, PNG, and WEBP are allowed."));
    }
  },
});

function handleMulterError(err: unknown, res: import("express").Response): boolean {
  if (err && typeof err === "object" && "code" in err) {
    if ((err as { code: string }).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File too large. Maximum size is 10 MB." });
      return true;
    }
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

const router = Router();

router.post("/images/enhance", (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (handleMulterError(err, res)) return;

    if (!req.file) {
      res.status(400).json({ error: "No image file uploaded." });
      return;
    }

    const {
      autoEnhance,
      increaseSharpness,
      improveContrast,
      improveBrightness,
      reduceNoise,
      upscale,
    } = req.body as Record<string, string>;

    const isTrue = (v: string | undefined) => v === "true";

    try {
      const inputPath = req.file.path;
      const originalMeta = await sharp(inputPath).metadata();
      const originalWidth = originalMeta.width ?? 0;
      const originalHeight = originalMeta.height ?? 0;

      const resultFilename = `enhanced_${crypto.randomBytes(12).toString("hex")}.png`;
      const resultPath = path.join(RESULTS_DIR, resultFilename);

      const appliedEnhancements: string[] = [];

      let pipeline = sharp(inputPath).flatten({ background: { r: 255, g: 255, b: 255 } });

      if (isTrue(reduceNoise)) {
        pipeline = pipeline.blur(0.6);
        appliedEnhancements.push("Reduce Noise");
      }

      if (isTrue(upscale)) {
        pipeline = pipeline.resize(originalWidth * 2, originalHeight * 2, {
          kernel: sharp.kernel.lanczos3,
        });
        appliedEnhancements.push("2× Upscale");
      }

      if (isTrue(autoEnhance)) {
        pipeline = pipeline
          .normalize()
          .sharpen({ sigma: 1.2, m1: 0.5, m2: 3 })
          .modulate({ brightness: 1.05, saturation: 1.1 });
        appliedEnhancements.push("Auto Enhance");
      }

      if (isTrue(increaseSharpness)) {
        pipeline = pipeline.sharpen({ sigma: isTrue(autoEnhance) ? 0.8 : 1.5, m1: 0.5, m2: 3 });
        appliedEnhancements.push("Increase Sharpness");
      }

      if (isTrue(improveContrast)) {
        pipeline = pipeline.linear(1.2, -(128 * 0.2));
        appliedEnhancements.push("Improve Contrast");
      }

      if (isTrue(improveBrightness)) {
        pipeline = pipeline.modulate({ brightness: 1.15 });
        appliedEnhancements.push("Improve Brightness");
      }

      if (appliedEnhancements.length === 0) {
        pipeline = pipeline.normalize().sharpen({ sigma: 0.8 });
        appliedEnhancements.push("Auto Enhance");
      }

      await pipeline.png({ compressionLevel: 6 }).toFile(resultPath);

      const enhancedMeta = await sharp(resultPath).metadata();
      const enhancedWidth = enhancedMeta.width ?? originalWidth;
      const enhancedHeight = enhancedMeta.height ?? originalHeight;

      const originalFilename = path.basename(inputPath);

      res.json({
        originalUrl: `/api/images/original/${originalFilename}`,
        enhancedUrl: `/api/images/result/${resultFilename}`,
        downloadFilename: resultFilename,
        originalSize: { width: originalWidth, height: originalHeight },
        enhancedSize: { width: enhancedWidth, height: enhancedHeight },
        appliedEnhancements,
      });
    } catch (procErr) {
      req.log.error({ err: procErr }, "Image enhancement failed");
      res.status(500).json({ error: "Image enhancement failed. Please try again." });
    }
  });
});

router.get("/images/original/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  res.sendFile(filePath);
});

router.get("/images/result/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(RESULTS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  res.sendFile(filePath);
});

router.get("/images/download/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(RESULTS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  res.download(filePath, "enhanced_image.png");
});

export default router;
