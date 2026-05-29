import React, { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, Activity, RotateCcw, Download, Maximize2, Image as ImageIcon, CheckCircle2, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface ResizeImageResult {
  originalSize: { width: number; height: number };
  croppedSize: { width: number; height: number } | null;
  resizedSize: { width: number; height: number };
  downloadFilename: string;
  previewUrl: string;
  whiteMarginRemoved: boolean;
}

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const PERCENTAGE_PRESETS = [25, 50, 75, 100, 150, 200];

export default function ResizeImage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [mode, setMode] = useState<"custom" | "percentage">("custom");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [percentage, setPercentage] = useState<string>("100");
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg">("png");

  const [removeWhiteMargins, setRemoveWhiteMargins] = useState(true);
  const [whiteSensitivity, setWhiteSensitivity] = useState<"low" | "medium" | "high">("medium");
  const [padding, setPadding] = useState("0");

  const [result, setResult] = useState<ResizeImageResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeMutation = useMutation<ResizeImageResult, Error, void>({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("image", file);
      formData.append("mode", mode);
      formData.append("width", width);
      formData.append("height", height);
      formData.append("maintainAspectRatio", maintainAspectRatio.toString());
      formData.append("percentage", percentage);
      formData.append("outputFormat", outputFormat);
      formData.append("removeWhiteMargins", removeWhiteMargins.toString());
      formData.append("whiteSensitivity", whiteSensitivity);
      formData.append("padding", padding);

      const res = await fetch("/api/resize/image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resize image");
      return data as ResizeImageResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Image resized successfully" });
    },
    onError: (error) => {
      toast({ title: "Resize failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFile = (selectedFile: File) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(selectedFile.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WEBP image.", variant: "destructive" });
      return;
    }
    if (selectedFile.size > MAX_IMAGE_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 20 MB.", variant: "destructive" });
      return;
    }
    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
    setResult(null);
    resizeMutation.reset();

    const img = new Image();
    img.onload = () => {
      setWidth(img.width.toString());
      setHeight(img.height.toString());
      setAspectRatio(img.width / img.height);
    };
    img.src = objectUrl;
  };

  const handleWidthChange = (val: string) => {
    setWidth(val);
    const w = parseFloat(val);
    if (!isNaN(w) && w > 0 && maintainAspectRatio && aspectRatio) {
      setHeight(Math.round(w / aspectRatio).toString());
    }
  };

  const handleHeightChange = (val: string) => {
    setHeight(val);
    const h = parseFloat(val);
    if (!isNaN(h) && h > 0 && maintainAspectRatio && aspectRatio) {
      setWidth(Math.round(h * aspectRatio).toString());
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setWidth("");
    setHeight("");
    setPercentage("100");
    resizeMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

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
          Resize Image
        </h1>
        <p className="text-muted-foreground text-lg">Change image dimensions with perfect precision</p>
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
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                ref={fileInputRef}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl pointer-events-none" />
              <div className="relative flex flex-col items-center space-y-6">
                <div className="p-6 bg-background/50 backdrop-blur-sm rounded-full shadow-lg border border-white/5 group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-2xl font-semibold">Drop your image here</h3>
                  <p className="text-muted-foreground">or click to browse — JPG, PNG, WEBP up to 20 MB</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {file && preview && !result && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2">
              <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-white/10 aspect-video flex items-center justify-center">
                <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain" />
                <div className="absolute top-4 left-4">
                  <Badge variant="secondary" className="bg-black/60 backdrop-blur">Original Preview</Badge>
                </div>
                {removeWhiteMargins && (
                  <div className="absolute bottom-4 left-4 right-4 flex justify-center">
                    <Badge variant="outline" className="bg-black/60 backdrop-blur border-white/15 text-white">
                      White margins will be removed after resize
                    </Badge>
                  </div>
                )}
                {resizeMutation.isPending && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-6 z-10">
                    <Activity className="w-12 h-12 text-primary animate-pulse" />
                    <p className="text-xl font-medium">Resizing Image…</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <Card className="p-5 bg-card/50 backdrop-blur border-white/10 space-y-5">
                <div className="flex items-center gap-2">
                  <Maximize2 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Resize Options</h3>
                </div>

                <div className="flex bg-black/40 rounded-full p-1 border border-white/5">
                  <button onClick={() => setMode("custom")}     className={pill(mode === "custom")}>Custom Size</button>
                  <button onClick={() => setMode("percentage")} className={pill(mode === "percentage")}>Percentage</button>
                </div>

                {mode === "custom" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Width (px)</Label>
                        <Input type="number" value={width} onChange={(e) => handleWidthChange(e.target.value)}
                          className="bg-black/50 border-white/10 h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Height (px)</Label>
                        <Input type="number" value={height} onChange={(e) => handleHeightChange(e.target.value)}
                          className="bg-black/50 border-white/10 h-9" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm cursor-pointer">Lock aspect ratio</Label>
                      <Switch checked={maintainAspectRatio} onCheckedChange={setMaintainAspectRatio} />
                    </div>
                  </div>
                )}

                {mode === "percentage" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {PERCENTAGE_PRESETS.map((p) => (
                        <Button key={p} size="sm" variant="outline"
                          className={percentage === p.toString() ? "bg-primary/20 text-primary border-primary/50" : "bg-black/50 border-white/10"}
                          onClick={() => setPercentage(p.toString())}>
                          {p}%
                        </Button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Custom %</Label>
                      <Input type="number" value={percentage} onChange={(e) => setPercentage(e.target.value)}
                        className="bg-black/50 border-white/10 h-9" min="1" max="1000" />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Output Format</Label>
                  <div className="flex bg-black/40 rounded-full p-1 border border-white/5">
                    <button onClick={() => setOutputFormat("png")}  className={pill(outputFormat === "png")}>PNG</button>
                    <button onClick={() => setOutputFormat("jpeg")} className={pill(outputFormat === "jpeg")}>JPEG (98%)</button>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-card/50 backdrop-blur border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-semibold">White Margin Removal</h3>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm cursor-pointer">Remove white margins</Label>
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
                      <Label className="text-xs">Safe padding after trim (px)</Label>
                      <Input type="number" value={padding} onChange={(e) => setPadding(e.target.value)}
                        className="bg-black/50 border-white/10 h-9" min="0" max="100" />
                    </div>
                  </div>
                )}
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" size="lg" className="flex-1 bg-white/5 border-white/10 hover:bg-white/10"
                  onClick={reset} disabled={resizeMutation.isPending}>
                  <RotateCcw className="w-4 h-4 mr-2" />Reset
                </Button>
                <Button size="lg"
                  className="flex-[2] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-500/25"
                  onClick={() => resizeMutation.mutate()}
                  disabled={resizeMutation.isPending || (mode === "custom" && !width && !height)}>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  {resizeMutation.isPending ? "Resizing…" : "Resize Image"}
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
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {preview && (
                <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-white/10 aspect-video flex items-center justify-center">
                  <img src={preview} alt="Original" className="max-w-full max-h-full object-contain" />
                  <div className="absolute top-4 left-4">
                    <Badge variant="secondary" className="bg-black/60 backdrop-blur">Original</Badge>
                  </div>
                </div>
              )}
              <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-white/10 aspect-video flex items-center justify-center">
                <img src={result.previewUrl} alt="Resized" className="max-w-full max-h-full object-contain" />
                <div className="absolute top-4 right-4">
                  <Badge className="bg-primary/80 backdrop-blur shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                    {result.whiteMarginRemoved ? "Trimmed + Resized" : "Resized"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 bg-card/50 backdrop-blur border-white/10 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Original</span>
                    <span className="font-mono">{result.originalSize.width} × {result.originalSize.height}</span>
                  </div>
                  {result.croppedSize && (
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-muted-foreground">After trim</span>
                      <span className="font-mono text-amber-400">{result.croppedSize.width} × {result.croppedSize.height}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Final size</span>
                    <span className="font-mono">{result.resizedSize.width} × {result.resizedSize.height}</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-muted-foreground">White margins</span>
                    <span className={result.whiteMarginRemoved ? "text-green-400" : "text-muted-foreground"}>
                      {result.whiteMarginRemoved ? "Removed" : "Kept"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-green-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Ready
                    </span>
                  </div>
                </div>
              </Card>

              <div className="flex flex-col justify-center gap-4">
                <Button size="lg"
                  className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-500/25"
                  asChild>
                  <a href={`/api/resize/download/${result.downloadFilename}`} download>
                    <Download className="w-6 h-6 mr-3" />Download Resized Image
                  </a>
                </Button>
                <Button variant="outline" size="lg" className="w-full h-14 bg-white/5 border-white/10 hover:bg-white/10" onClick={reset}>
                  <RotateCcw className="w-5 h-5 mr-2" />Resize Another Image
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
