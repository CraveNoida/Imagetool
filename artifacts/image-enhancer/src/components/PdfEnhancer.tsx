import React, { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, Download, AlertCircle, RotateCcw, Activity, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface PdfEnhanceResult {
  downloadFilename: string;
  pageCount: number;
  originalFilename: string;
  fileSizeBytes: number;
  renderScale?: number;
}

const MAX_PDF_SIZE = 100 * 1024 * 1024;
const MAX_PDF_SIZE_LABEL = "100 MB";
const MAX_PAGES = 100;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getLoadingMessage(pageCount?: number): string {
  if (!pageCount) return "Enhancing your PDF…";
  if (pageCount <= 3)  return "Almost done…";
  if (pageCount <= 10) return "Enhancing pages — this may take 20–40 seconds.";
  return "Processing 11–100 pages — this can take a few minutes.";
}

export default function PdfEnhancer() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<PdfEnhanceResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enhanceMutation = useMutation<PdfEnhanceResult, Error, File>({
    mutationFn: async (uploadFile) => {
      const formData = new FormData();
      formData.append("pdf", uploadFile);

      const res = await fetch("/api/pdf/enhance", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "PDF enhancement failed. Please try again.");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "PDF enhanced successfully" });
    },
    onError: (error) => {
      toast({
        title: "Enhancement failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFile = (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Unsupported file type", description: "Please upload a PDF file (.pdf).", variant: "destructive" });
      return;
    }
    if (selectedFile.size > MAX_PDF_SIZE) {
      toast({ title: "File too large", description: `Maximum allowed size is ${MAX_PDF_SIZE_LABEL}.`, variant: "destructive" });
      return;
    }
    setFile(selectedFile);
    setResult(null);
    enhanceMutation.reset();
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    enhanceMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 relative z-10">
      <div className="text-center space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 pb-2">
          AI PDF Enhancer
        </h1>
        <p className="text-muted-foreground text-lg">Make your documents crystal clear</p>
      </div>

      <AnimatePresence mode="wait">
        {!file && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full"
          >
            <div
              className={`relative group flex flex-col items-center justify-center p-12 md:p-24 border-2 border-dashed rounded-3xl transition-all duration-300 cursor-pointer ${
                isDragging
                  ? "border-primary bg-primary/10 scale-[1.02]"
                  : "border-muted bg-card hover:border-primary/50 hover:bg-muted/50"
              }`}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                className="hidden"
                accept=".pdf,application/pdf"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl pointer-events-none" />
              <div className="relative flex flex-col items-center space-y-6">
                <div className="p-6 bg-background/50 backdrop-blur-sm rounded-full shadow-lg border border-white/5 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-2xl font-semibold">Drop your PDF here</h3>
                  <p className="text-muted-foreground">or click to browse — up to {MAX_PDF_SIZE_LABEL}, max {MAX_PAGES} pages</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {file && !result && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl mx-auto space-y-6"
          >
            <Card className="p-8 bg-card/50 backdrop-blur border-white/10 relative overflow-hidden">
              {enhanceMutation.isPending && (
                <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_100%] animate-[shimmer_1.5s_linear_infinite]" />
                </div>
              )}

              <div className="flex flex-col items-center text-center space-y-6">
                {enhanceMutation.isPending ? (
                  <>
                    <Activity className="w-16 h-16 text-primary animate-pulse" />
                    <div className="space-y-2">
                      <h3 className="text-2xl font-semibold">Enhancing your PDF...</h3>
                      <p className="text-muted-foreground">{getLoadingMessage()}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Do not close this tab while processing is in progress.
                      </p>
                    </div>
                  </>
                ) : enhanceMutation.isError ? (
                  <>
                    <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-semibold text-destructive">Enhancement Failed</h3>
                      <p className="text-muted-foreground text-sm max-w-md">
                        {enhanceMutation.error?.message || "An unexpected error occurred."}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <FileText className="w-16 h-16 text-primary" />
                    <div className="space-y-1">
                      <h3 className="text-2xl font-semibold break-all">{file.name}</h3>
                      <p className="text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                  </>
                )}

                <div className="flex w-full gap-4 pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1 bg-white/5 border-white/10 hover:bg-white/10"
                    onClick={reset}
                    disabled={enhanceMutation.isPending}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {enhanceMutation.isError ? "Choose Different File" : "Cancel"}
                  </Button>

                  {!enhanceMutation.isError && (
                    <Button
                      size="lg"
                      className="flex-[2] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-500/25"
                      onClick={() => enhanceMutation.mutate(file)}
                      disabled={enhanceMutation.isPending}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      {enhanceMutation.isPending ? "Processing..." : "Enhance PDF"}
                    </Button>
                  )}

                  {enhanceMutation.isError && (
                    <Button
                      size="lg"
                      className="flex-[2] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-500/25"
                      onClick={() => enhanceMutation.mutate(file)}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Retry Enhancement
                    </Button>
                  )}
                </div>
              </div>
            </Card>
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
                <h3 className="text-2xl font-bold">PDF Enhanced Successfully</h3>
                <p className="text-muted-foreground text-sm">
                  Your document has been processed and is ready to download.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-center space-y-1">
                  <p className="text-sm text-muted-foreground">Pages</p>
                  <p className="text-xl font-mono font-semibold">{result.pageCount}</p>
                </div>
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-center space-y-1">
                  <p className="text-sm text-muted-foreground">Original Size</p>
                  <p className="text-xl font-mono font-semibold">{formatBytes(result.fileSizeBytes)}</p>
                </div>
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-center space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="text-xl text-green-400 font-medium">Ready</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Applied Enhancements</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Increase Sharpness", "Improve Contrast", "Improve Brightness", "Reduce Noise", "Text Clarity"].map((label) => (
                    <Badge key={label} variant="outline" className="bg-primary/10 border-primary/20 text-primary-foreground px-3 py-1">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-2">
                <Button
                  size="lg"
                  className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-500/25"
                  asChild
                >
                  <a href={`/api/pdf/download/${result.downloadFilename}`} download="enhanced.pdf">
                    <Download className="w-6 h-6 mr-3" />
                    Download Enhanced PDF
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-14 bg-white/5 border-white/10 hover:bg-white/10"
                  onClick={reset}
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Enhance Another PDF
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
