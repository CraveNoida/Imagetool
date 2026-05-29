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

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_PDF_SIZE = 100 * 1024 * 1024;
const MAX_PDF_PAGES = 100;

const PAGE_PRESETS_PX: Record<string, [number, number]> = {
  A4:     [1240, 1754],
  A3:     [1754, 2480],
  Letter: [1275, 1650],
  Legal:  [1275, 2100],
};

function toPixels(value: number, unit: string): number {
  const DPI = 150;
  switch (unit) {
    case "mm":   return Math.round(value * DPI / 25.4);
    case "inch": return Math.round(value * DPI);
    default:     return Math.round(value);
  }
}

function tryDelete(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

function getWhiteThreshold(sensitivity: string): number {
  switch (sensitivity) {
    case "low":  return 5;
    case "high": return 35;
    default:     return 18;
  }
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, _file, cb) => {
    const ext = _file.originalname.split(".").pop()?.toLowerCase() ?? "jpg";
    cb(null, `${crypto.randomBytes(12).toString("hex")}.${ext}`);
  },
});
const uploadImage = multer({
  storage: imageStorage,
  limits:  { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
  },
});

const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, _file, cb) =>
    cb(null, `${crypto.randomBytes(12).toString("hex")}.pdf`),
});
const uploadPdf = multer({
  storage: pdfStorage,
  limits:  { fileSize: MAX_PDF_SIZE },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    ok ? cb(null, true) : cb(new Error("Only PDF files are allowed."));
  },
});

function handleMulterError(err: unknown, res: import("express").Response): boolean {
  if (err && typeof err === "object" && "code" in err) {
    if ((err as { code: string }).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File too large." });
      return true;
    }
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

async function trimWhiteMargins(
  input: Buffer | string,
  threshold: number,
  padding: number
): Promise<Buffer> {
  let pipeline = sharp(input).flatten({ background: { r: 255, g: 255, b: 255 } });

  pipeline = pipeline.trim({
    background: "#ffffff",
    threshold,
  });

  if (padding > 0) {
    pipeline = pipeline.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  }

  return pipeline.png({ compressionLevel: 3 }).toBuffer();
}

const router = Router();

router.post("/resize/image", (req, res) => {
  uploadImage.single("image")(req, res, async (err) => {
    if (handleMulterError(err, res)) return;
    if (!req.file) { res.status(400).json({ error: "No image file uploaded." }); return; }

    try {
      const {
        mode,
        width,
        height,
        percentage,
        maintainAspectRatio,
        removeWhiteMargins,
        whiteSensitivity,
        padding,
        outputFormat,
      } = req.body as Record<string, string>;

      const doTrim        = removeWhiteMargins === "true";
      const trimThreshold = getWhiteThreshold(whiteSensitivity ?? "medium");
      const safePadding   = Math.max(0, Math.min(150, parseInt(padding ?? "40", 10) || 40));
      const usePng    = outputFormat === "png";

      let workingBuffer: Buffer;

      if (doTrim) {
        workingBuffer = await trimWhiteMargins(req.file.path, trimThreshold, safePadding);
      } else {
        workingBuffer = await sharp(req.file.path).png({ compressionLevel: 3 }).toBuffer();
      }

      const meta = await sharp(workingBuffer).metadata();
      const origW = meta.width ?? 0;
      const origH = meta.height ?? 0;

      let targetW: number | undefined;
      let targetH: number | undefined;
      const keepRatio = maintainAspectRatio !== "false";

      if (mode === "percentage") {
        const pct = Math.max(1, Math.min(500, parseFloat(percentage) || 100));
        targetW = Math.round(origW * pct / 100);
        targetH = Math.round(origH * pct / 100);
      } else {
        targetW = width  ? Math.max(1, parseInt(width,  10)) : undefined;
        targetH = height ? Math.max(1, parseInt(height, 10)) : undefined;
      }

      if (!targetW && !targetH) {
        res.status(400).json({ error: "Please provide target width, height, or percentage." });
        return;
      }

      const ext = usePng ? "png" : "jpg";
      const resultFilename = `resized_${crypto.randomBytes(12).toString("hex")}.${ext}`;
      const resultPath = path.join(RESULTS_DIR, resultFilename);

      const resizePipeline = sharp(workingBuffer).resize({
        width:  targetW,
        height: targetH,
        fit:    keepRatio ? "inside" : "fill",
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      });

      if (usePng) {
        await resizePipeline.png({ compressionLevel: 6 }).toFile(resultPath);
      } else {
        await resizePipeline.jpeg({ quality: 98, mozjpeg: false }).toFile(resultPath);
      }

      const resultMeta = await sharp(resultPath).metadata();

      const originalMeta = await sharp(req.file.path).metadata();

      res.json({
        originalSize:       { width: originalMeta.width, height: originalMeta.height },
        croppedSize:        doTrim ? { width: origW, height: origH } : null,
        resizedSize:        { width: resultMeta.width, height: resultMeta.height },
        downloadFilename:   resultFilename,
        previewUrl:         `/api/resize/preview/${resultFilename}`,
        whiteMarginRemoved: doTrim,
      });
    } catch (procErr) {
      req.log.error({ err: procErr }, "Image resize failed");
      res.status(500).json({ error: "Image resize failed. Please try again." });
    }
  });
});

router.post("/resize/pdf", (req, res) => {
  uploadPdf.single("pdf")(req, res, async (err) => {
    if (handleMulterError(err, res)) return;
    if (!req.file) { res.status(400).json({ error: "No PDF file uploaded." }); return; }

    let doc: mupdf.PDFDocument | null = null;

    try {
      const {
        preset,
        customWidth,
        customHeight,
        unit,
        orientation,
        fitMode,
        outputFormat,
        removeWhiteMargins,
        whiteSensitivity,
        padding,
      } = req.body as Record<string, string>;

      const doTrim        = removeWhiteMargins === "true";
      const trimThreshold = getWhiteThreshold(whiteSensitivity ?? "medium");
      const safePadding   = Math.max(0, Math.min(150, parseInt(padding ?? "60", 10) || 60));

      let targetWPx: number;
      let targetHPx: number;

      if (preset && preset !== "Custom" && PAGE_PRESETS_PX[preset]) {
        [targetWPx, targetHPx] = PAGE_PRESETS_PX[preset];
      } else {
        const w = parseFloat(customWidth);
        const h = parseFloat(customHeight);
        if (!w || !h || w <= 0 || h <= 0) {
          res.status(400).json({ error: "Please provide valid custom width and height." });
          return;
        }
        targetWPx = toPixels(w, unit ?? "px");
        targetHPx = toPixels(h, unit ?? "px");
      }

      if (orientation === "landscape" && targetHPx > targetWPx) {
        [targetWPx, targetHPx] = [targetHPx, targetWPx];
      } else if (orientation === "portrait" && targetWPx > targetHPx) {
        [targetWPx, targetHPx] = [targetHPx, targetWPx];
      }

      const isFill = fitMode === "fill";
      const usePng = outputFormat === "png";

      const inputBytes = fs.readFileSync(req.file.path);
      try {
        doc = mupdf.Document.openDocument(inputBytes, "application/pdf") as mupdf.PDFDocument;
      } catch {
        res.status(400).json({ error: "Could not open PDF. The file may be corrupt or unsupported." });
        return;
      }

      const pageCount = doc.countPages();
      if (pageCount === 0) { res.status(400).json({ error: "PDF has no pages." }); return; }
      if (pageCount > MAX_PDF_PAGES) {
        res.status(400).json({ error: `PDF has ${pageCount} pages. Maximum allowed is ${MAX_PDF_PAGES}.` });
        return;
      }

      const destDoc    = await PDFDocument.create();
      const colorspace = mupdf.ColorSpace.DeviceRGB;

      for (let i = 0; i < pageCount; i++) {
        const page   = doc.loadPage(i) as mupdf.Page;
        const bounds = page.getBounds();
        const srcW   = bounds[2] - bounds[0];
        const srcH   = bounds[3] - bounds[1];

        const renderScaleX = (targetWPx * 2.5) / srcW;
        const renderScaleY = (targetHPx * 2.5) / srcH;
        const renderScale  = Math.min(Math.max(renderScaleX, renderScaleY, 2.5), 6.0);

        const matrix  = mupdf.Matrix.scale(renderScale, renderScale);
        const pixmap  = page.toPixmap(matrix, colorspace, false);
        const rawPng  = Buffer.from(pixmap.asPNG());
        pixmap.destroy();

        let pageBuffer: Buffer;
        if (doTrim) {
          pageBuffer = await trimWhiteMargins(rawPng, trimThreshold, safePadding);
        } else {
          pageBuffer = rawPng;
        }

        const resized = sharp(pageBuffer)
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .resize(targetWPx, targetHPx, {
            fit:        isFill ? "cover" : "contain",
            position:   "center",
            background: { r: 255, g: 255, b: 255, alpha: 1 },
            kernel:     sharp.kernel.lanczos3,
          });

        if (usePng) {
          const pngBuf = await resized.png({ compressionLevel: 6 }).toBuffer();
          const pngImg = await destDoc.embedPng(pngBuf);
          const newPage = destDoc.addPage([targetWPx, targetHPx]);
          newPage.drawImage(pngImg, { x: 0, y: 0, width: targetWPx, height: targetHPx });
        } else {
          const jpgBuf = await resized.jpeg({ quality: 98, mozjpeg: false }).toBuffer();
          const jpgImg = await destDoc.embedJpg(jpgBuf);
          const newPage = destDoc.addPage([targetWPx, targetHPx]);
          newPage.drawImage(jpgImg, { x: 0, y: 0, width: targetWPx, height: targetHPx });
        }
      }

      doc.destroy();
      doc = null;

      const pdfBytes       = await destDoc.save({ useObjectStreams: true, addDefaultPage: false });
      const resultFilename = `resized_${crypto.randomBytes(12).toString("hex")}.pdf`;
      fs.writeFileSync(path.join(RESULTS_DIR, resultFilename), pdfBytes);

      res.json({
        downloadFilename:   resultFilename,
        pageCount,
        originalFilename:   req.file.originalname,
        fileSizeBytes:      req.file.size,
        targetWidth:        targetWPx,
        targetHeight:       targetHPx,
        outputFormat:       usePng ? "png" : "jpeg",
        whiteMarginRemoved: doTrim,
      });
    } catch (procErr) {
      req.log.error({ err: procErr }, "PDF resize failed");
      res.status(500).json({ error: "PDF resize failed. The file may be corrupt or contain unsupported content." });
    } finally {
      try { doc?.destroy(); } catch { /* ignore */ }
    }
  });
});

router.get("/resize/preview/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(RESULTS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found." }); return; }
  res.sendFile(filePath);
});

router.get("/resize/download/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(RESULTS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found." }); return; }
  const ext = safeFilename.endsWith(".pdf") ? "pdf" : safeFilename.endsWith(".jpg") ? "jpg" : "png";
  res.download(filePath, `resized.${ext}`);
});

export default router;
