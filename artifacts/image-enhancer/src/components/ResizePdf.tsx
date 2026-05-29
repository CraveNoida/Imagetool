import React, { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, Download, Activity, RotateCcw, CheckCircle2, FileCode2, AlertTriangle, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface ResizePdfResult {
  downloadFilename: string;
  pageCount: number;
  originalFilename: string;
  fileSizeBytes: number;
  targetWidth: number;
  targetHeight: number;
  outputFormat: "jpeg" | "png";
  whiteMarginRemoved: boolean;
}

const MAX_PDF_SIZE = 100 * 1024 * 1024;
const MAX_PAGES = 100;
const PRESETS = ["A4", "A3", "Letter", "Legal", "Custom"];

const PRESET_DIMS: Record<string, string> = {
  A4:     "1240 × 1754 px",
  A3:     "1754 × 2480 px",
  Letter: "1275 × 1650 px",
  Legal:  "1275 × 2100 px",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function ResizePdf() {
  const [file, setFile]         = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [preset, setPreset]             = useState("A4");
  const [customWidth, setCustomWidth]   = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [unit, setUnit]                 = useState("px");
  const [orientation, setOrientation]   = useState("portrait");
  const [fitMode, setFitMode]           = useState<"fit" | "fill">("fit");
  const [outputFormat, setOutputFormat] = useState<"jpeg" | "png">("jpeg");

  const [removeWhiteMargins, setRemoveWhiteMargins] = useState(false);
  const [whiteSensitivity, setWhiteSensitivity]     = useState<"low" | "medium" | "high">("medium");
  const [padding, setPadding]                       = useState("60");

  const [result, setResult] = useState<ResizePdfResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeMutation = useMutation<ResizePdfResult, Error, void>({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("preset", preset);
      formData.append("customWidth", customWidth);
      formData.append("customHeight", customHeight);
      formData.append("unit", unit);
      formData.append("orientation", orientation);
      formData.append("fitMode", fitMode);
      formData.append("outputFormat", outputFormat);
      formData.append("removeWhiteMargins", removeWhiteMargins.toString());
      formData.append("whiteSensitivity", whiteSensitivity);
      formData.append("padding", padding);

      const res = await fetch("/api/resize/pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resize PDF");
      return data as ResizePdfResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "PDF resized successfully" });
    },
    onError: (error) => {
      toast({ title: "Resize failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFile = (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Unsupported file type", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    if (selectedFile.size > MAX_PDF_SIZE) {
      toast({ title: "File too large", description: "Maximum allowed size is 100 MB.", variant: "destructive" });
      return;
    }
    setFile(selectedFile);
    setResult(null);
    resizeMutation.reset();
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setPreset("A4");
    setCustomWidth("");
    setCustomHeight("");
    setUnit("px");
    setOrientation("portrait");
    setFitMode("fit");
    setOutputFormat("jpeg");
    setRemoveWhiteMargins(false);
    setWhiteSensitivity("medium");
    setPadding("60");
    resizeMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const pill = (active: boolean) =>
    `flex-1 py-2 rounded-full text-sm font-medium transition-all ${
      active
        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
        : "text-muted-foreground hover:text-white"
    }`;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 relative z-10">
      <div className="text-center space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 pb-2">
          Resize PDF
        </h1>
        <p className="text-muted-foreground text-lg">Resize every page to exact dimensions</p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
        <span>
          <span className="font-semibold text-amber-300">Note: </span>
          After resizing, PDF text becomes non-selectable because each page is converted into an image.
          Use PNG output for maximum sharpness on text-heavy documents.
        </span>
      </div>

      <AnimatePresence mode="wait">
        {!file && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div
              className={`relative group flex flex-col items-center justify-center p-12 md:p-24 border-2 border-dashed rounded-3xl transition-all duration-300 cursor-pointer ${
                isDragging
                  ? "border-primary bg-primary/10 scale-[1.02]"
                  : "border-muted bg-card hover:border-primary/50 hover:bg-muted/50"
              }`}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" className="hidden" accept=".pdf,application/pdf" ref={fileInputRef}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl pointer-events-none" />
              <div className="relative flex flex-col items-center space-y-6">
                <div className="p-6 bg-background/50 backdrop-blur-sm rounded-full shadow-lg border border-white/5 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-2xl font-semibold">Drop your PDF here</h3>
                  <p className="text-muted-foreground">or click to browse — up to 100 MB, max {MAX_PAGES} pages</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {file && !result && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-1">
              <Card className="p-8 bg-card/50 backdrop-blur border-white/10 h-full flex flex-col items-center justify-center text-center space-y-4">
                <FileText className="w-16 h-16 text-primary" />
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold break-all">{file.name}</h3>
                  <p className="text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <Card className="p-5 bg-card/50 backdrop-blur border-white/10 relative overflow-hidden">
                {resizeMutation.isPending && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 z-10 rounded-xl">
                    <Activity className="w-12 h-12 text-primary animate-pulse" />
                    <p className="text-xl font-medium">Resizing PDF…</p>
                    <p className="text-sm text-muted-foreground">Rendering pages at 2.5× resolution</p>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-5">
                  <FileCode2 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Output Options</h3>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs">Target Size</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map((p) => (
                        <Button key={p} size="sm" variant="outline"
                          className={preset === p ? "bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white" : "bg-black/50 border-white/10"}
                          onClick={() => setPreset(p)}>
                          {p}
                        </Button>
                      ))}
                    </div>
                    {preset !== "Custom" && PRESET_DIMS[preset] && (
                      <p className="text-xs text-muted-foreground pl-1">{PRESET_DIMS[preset]} at 150 dpi</p>
                    )}
                  </div>

                  {preset === "Custom" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Width</Label>
                        <Input type="number" placeholder="e.g. 1440" value={customWidth}
                          onChange={(e) => setCustomWidth(e.target.value)} className="bg-black/50 border-white/10 h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Height</Label>
                        <Input type="number" placeholder="e.g. 1800" value={customHeight}
                          onChange={(e) => setCustomHeight(e.target.value)} className="bg-black/50 border-white/10 h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Unit</Label>
                        <select value={unit} onChange={(e) => setUnit(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <option value="px">px</option>
                          <option value="mm">mm</option>
                          <option value="inch">inch</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Orientation</Label>
                    <div className="flex bg-black/40 rounded-full p-1 border border-white/5">
                      <button onClick={() => setOrientation("portrait")}  className={pill(orientation === "portrait")}>Portrait</button>
                      <button onClick={() => setOrientation("landscape")} className={pill(orientation === "landscape")}>Landscape</button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Content Mode</Label>
                      <span className="text-xs text-muted-foreground">
                        {fitMode === "fit" ? "White bars if ratio differs" : "Crops edges to fill page"}
                      </span>
                    </div>
                    <div className="flex bg-black/40 rounded-full p-1 border border-white/5">
                      <button onClick={() => setFitMode("fit")}  className={pill(fitMode === "fit")}>Fit (no crop)</button>
                      <button onClick={() => setFitMode("fill")} className={pill(fitMode === "fill")}>Fill (crop edges)</button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Output Format</Label>
                      <span className="text-xs text-muted-foreground">
                        {outputFormat === "jpeg" ? "Quality 98 — smaller file" : "Lossless — sharpest text"}
                      </span>
                    </div>
                    <div className="flex bg-black/40 rounded-full p-1 border border-white/5">
                      <button onClick={() => setOutputFormat("jpeg")} className={pill(outputFormat === "jpeg")}>JPEG (High Quality)</button>
                      <button onClick={() => setOutputFormat("png")}  className={pill(outputFormat === "png")}>PNG (Lossless)</button>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-card/50 backdrop-blur border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-semibold">White Margin Removal</h3>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm cursor-pointer">Remove white margins before resizing</Label>
                  <Switch checked={removeWhiteMargins} onCheckedChange={setRemoveWhiteMargins} />
                </div>

                {removeWhiteMargins && (
                  <div className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Detection sensitivity</Label>
                      <div className="flex bg-black/40 rounded-full p-1 border border-white/5">
                        {(["low", "medium", "high"] as const).map((s) => (
                          <button key={s} onClick={() => setWhiteSensitivity(s)} className={pill(whiteSensitivity === s)}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground pl-1">
                        {whiteSensitivity === "low" && "Only pure white (threshold 5)"}
                        {whiteSensitivity === "medium" && "Near-white, default (threshold 18)"}
                        {whiteSensitivity === "high" && "Off-white & light backgrounds (threshold 35)"}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Safe padding after crop (px)</Label>
                      <Input type="number" value={padding} onChange={(e) => setPadding(e.target.value)}
                        className="bg-black/50 border-white/10 h-9" min="20" max="150" />
                    </div>
                  </div>
                )}
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" size="lg" className="flex-1 bg-white/5 border-white/10 hover:bg-white/10"
                  onClick={reset} disabled={resizeMutation.isPending}>
                  <RotateCcw className="w-4 h-4 mr-2" />Cancel
                </Button>
                <Button size="lg"
                  className="flex-[2] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-500/25"
                  onClick={() => resizeMutation.mutate()}
                  disabled={resizeMutation.isPending || (preset === "Custom" && (!customWidth || !customHeight))}>
                  <FileCode2 className="w-4 h-4 mr-2" />
                  {resizeMutation.isPending ? "Resizing…" : "Resize PDF"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl mx-auto space-y-8"
          >
            <Card className="p-8 bg-card/50 backdrop-blur border-white/10 space-y-8">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold">PDF Resized Successfully</h3>
                <p className="text-muted-foreground text-sm">
                  Every page is now{" "}
                  <span className="text-white font-medium">{result.targetWidth} × {result.targetHeight} px</span>
                  {" "}as{" "}
                  <span className="text-white font-medium">{result.outputFormat === "png" ? "lossless PNG" : "JPEG quality 98"}</span>.
                  {result.whiteMarginRemoved && (
                    <span className="text-green-400"> White margins were removed.</span>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Pages",   value: result.pageCount },
                  { label: "Width",   value: result.targetWidth },
                  { label: "Height",  value: result.targetHeight },
                  { label: "Format",  value: result.outputFormat.toUpperCase() },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 rounded-xl bg-black/40 border border-white/5 text-center space-y-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-mono font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-4 pt-2">
                <Button size="lg"
                  className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-500/25"
                  asChild>
                  <a href={`/api/resize/download/${result.downloadFilename}`} download="resized.pdf">
                    <Download className="w-6 h-6 mr-3" />Download Resized PDF
                  </a>
                </Button>
                <Button variant="outline" size="lg" className="w-full h-14 bg-white/5 border-white/10 hover:bg-white/10" onClick={reset}>
                  <RotateCcw className="w-5 h-5 mr-2" />Resize Another PDF
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
