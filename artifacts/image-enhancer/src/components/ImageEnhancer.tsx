import React, { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, SlidersHorizontal, Image as ImageIcon, Download, Sparkles, RotateCcw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface EnhanceResult {
  originalUrl: string;
  enhancedUrl: string;
  downloadFilename: string;
  originalSize: { width: number; height: number };
  enhancedSize: { width: number; height: number };
  appliedEnhancements: string[];
}

interface Options {
  autoEnhance: boolean;
  increaseSharpness: boolean;
  improveContrast: boolean;
  improveBrightness: boolean;
  reduceNoise: boolean;
  upscale: boolean;
}

const DEFAULT_OPTIONS: Options = {
  autoEnhance: true,
  increaseSharpness: false,
  improveContrast: false,
  improveBrightness: false,
  reduceNoise: false,
  upscale: false,
};

const OPTION_LABELS: Record<keyof Options, string> = {
  autoEnhance: "Auto Enhance",
  increaseSharpness: "Increase Sharpness",
  improveContrast: "Improve Contrast",
  improveBrightness: "Improve Brightness",
  reduceNoise: "Reduce Noise",
  upscale: "2× Upscale",
};

export default function ImageEnhancer() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enhanceMutation = useMutation<EnhanceResult, Error, { file: File; options: Options }>({
    mutationFn: async ({ file, options }) => {
      const formData = new FormData();
      formData.append("image", file);
      Object.entries(options).forEach(([k, v]) => formData.append(k, v.toString()));

      const res = await fetch("/api/images/enhance", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to enhance image");
      return data as EnhanceResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Image enhanced successfully" });
    },
    onError: (error) => {
      toast({ title: "Enhancement failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFile = (selectedFile: File) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or WEBP image.",
        variant: "destructive",
      });
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
      return;
    }
    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
    setResult(null);
    enhanceMutation.reset();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setOptions(DEFAULT_OPTIONS);
    enhanceMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 relative z-10">
      <div className="text-center space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 pb-2">
          AI Image Quality Enhancer
        </h1>
        <p className="text-muted-foreground text-lg">Professional grade enhancement in your browser</p>
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
              onDrop={handleDrop}
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
                  <p className="text-muted-foreground">or click to browse — JPG, PNG, WEBP up to 10 MB</p>
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
                {enhanceMutation.isPending && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-6 z-10">
                    <Activity className="w-12 h-12 text-primary animate-pulse" />
                    <div className="space-y-2 text-center">
                      <p className="text-xl font-medium">Enhancing Image…</p>
                      <p className="text-sm text-primary/80">Applying processing pipeline</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <Card className="p-6 bg-card/50 backdrop-blur border-white/10">
                <div className="flex items-center gap-2 mb-6">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Enhancement Options</h3>
                </div>
                <div className="space-y-5">
                  {(Object.keys(DEFAULT_OPTIONS) as (keyof Options)[]).map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                        {OPTION_LABELS[key]}
                      </Label>
                      <Switch
                        id={key}
                        checked={options[key]}
                        onCheckedChange={(checked) =>
                          setOptions((prev) => ({ ...prev, [key]: checked }))
                        }
                        disabled={enhanceMutation.isPending}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 bg-white/5 border-white/10 hover:bg-white/10"
                  onClick={reset}
                  disabled={enhanceMutation.isPending}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button
                  size="lg"
                  className="flex-[2] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-500/25"
                  onClick={() => file && enhanceMutation.mutate({ file, options })}
                  disabled={enhanceMutation.isPending}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {enhanceMutation.isPending ? "Enhancing…" : "Enhance Image"}
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
            <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-white/10 aspect-video">
              <div className="absolute inset-0 flex">
                <div className="w-1/2 h-full overflow-hidden relative border-r border-white/20">
                  <img
                    src={result.originalUrl}
                    alt="Original"
                    className="absolute w-[200%] h-full object-cover max-w-none left-0"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge variant="secondary" className="bg-black/60 backdrop-blur">Original</Badge>
                  </div>
                </div>
                <div className="w-1/2 h-full overflow-hidden relative">
                  <img
                    src={result.enhancedUrl}
                    alt="Enhanced"
                    className="absolute w-[200%] h-full object-cover max-w-none right-0"
                  />
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-primary/80 backdrop-blur shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                      Enhanced
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 bg-card/50 backdrop-blur border-white/10 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Original</span>
                    <span className="font-mono">
                      {result.originalSize.width} × {result.originalSize.height}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Enhanced</span>
                    <span className="font-mono">
                      {result.enhancedSize.width} × {result.enhancedSize.height}
                    </span>
                  </div>
                  <div className="space-y-2 pt-1">
                    <span className="text-muted-foreground">Applied</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {result.appliedEnhancements.map((e, i) => (
                        <Badge key={i} variant="outline" className="bg-primary/10 border-primary/20">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex flex-col justify-center gap-4">
                <Button
                  size="lg"
                  className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-500/25"
                  asChild
                >
                  <a href={`/api/images/download/${result.downloadFilename}`} download>
                    <Download className="w-6 h-6 mr-3" />
                    Download Enhanced Image
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-14 bg-white/5 border-white/10 hover:bg-white/10"
                  onClick={reset}
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Enhance Another Image
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
