import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import * as mupdf from "mupdf";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
const RESULTS_DIR = path.resolve(__dirname, "../../results");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const MAX_PDF_SIZE = 100 * 1024 * 1024;
const MAX_PDF_SIZE_LABEL = "100 MB";
const MAX_PAGES = 100;

function getRenderScale(pageCount: number): number {
  if (pageCount > 10) return 1.25;
  if (pageCount > 5)  return 1.5;
  return 1.75;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, _file, cb) => {
    const unique = crypto.randomBytes(12).toString("hex");
    cb(null, `${unique}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_PDF_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."));
    }
  },
});

function multerErrorHandler(
  err: unknown,
  res: import("express").Response
): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: `File too large. Maximum allowed size is ${MAX_PDF_SIZE_LABEL}.` });
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

router.post("/pdf/enhance", (req, res) => {
  upload.single("pdf")(req, res, async (err) => {
    if (multerErrorHandler(err, res)) return;

    if (!req.file) {
      res.status(400).json({ error: "No PDF file uploaded." });
      return;
    }

    let doc: mupdf.PDFDocument | null = null;

    try {
      const inputBytes = fs.readFileSync(req.file.path);

      try {
        doc = mupdf.Document.openDocument(inputBytes, "application/pdf") as mupdf.PDFDocument;
      } catch {
        res.status(400).json({ error: "Could not open PDF. The file may be corrupt or unsupported." });
        return;
      }

      const pageCount = doc.countPages();

      if (pageCount === 0) {
        res.status(400).json({ error: "The PDF appears to be empty (0 pages)." });
        return;
      }

      if (pageCount > MAX_PAGES) {
        res.status(400).json({
          error: `PDF has ${pageCount} pages. Maximum allowed is ${MAX_PAGES}.`,
        });
        return;
      }

      const scale      = getRenderScale(pageCount);
      const matrix     = mupdf.Matrix.scale(scale, scale);
      const colorspace = mupdf.ColorSpace.DeviceRGB;
      const outputPdf  = await PDFDocument.create();

      for (let i = 0; i < pageCount; i++) {
        const page   = doc.loadPage(i) as mupdf.Page;
        const pixmap = page.toPixmap(matrix, colorspace, false);
        const rawPng = Buffer.from(pixmap.asPNG());
        pixmap.destroy();

        // Use JPEG for embedding — 5-10× smaller than PNG so pdf-lib serialises fast
        const jpegBuffer = await sharp(rawPng)
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .blur(0.4)
          .sharpen({ sigma: 1.2, m1: 0.8, m2: 3.5 })
          .normalize()
          .modulate({ brightness: 1.05, saturation: 1.0 })
          .linear(1.1, -(128 * 0.1))
          .jpeg({ quality: 94, mozjpeg: false })
          .toBuffer();

        const jpgImage = await outputPdf.embedJpg(jpegBuffer);
        const { width, height } = jpgImage.scale(1 / scale);
        const pdfPage = outputPdf.addPage([width, height]);
        pdfPage.drawImage(jpgImage, { x: 0, y: 0, width, height });
      }

      doc.destroy();
      doc = null;

      const pdfBytes = await outputPdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const resultFilename = `enhanced_${crypto.randomBytes(12).toString("hex")}.pdf`;
      fs.writeFileSync(path.join(RESULTS_DIR, resultFilename), pdfBytes);

      res.json({
        downloadFilename: resultFilename,
        pageCount,
        originalFilename: req.file.originalname,
        fileSizeBytes:    req.file.size,
        renderScale:      scale,
      });
    } catch (procErr) {
      req.log.error({ err: procErr }, "PDF enhancement failed");
      res.status(500).json({
        error: "PDF enhancement failed. The file may be corrupt, password-protected, or contain unsupported content.",
      });
    } finally {
      try { doc?.destroy(); } catch { /* ignore */ }
    }
  });
});

router.get("/pdf/view/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  res.sendFile(filePath);
});

router.get("/pdf/download/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(RESULTS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  res.download(filePath, "enhanced.pdf");
});

export default router;
