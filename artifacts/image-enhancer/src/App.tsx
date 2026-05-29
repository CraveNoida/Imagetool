import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ImageEnhancer from "@/components/ImageEnhancer";
import PdfEnhancer from "@/components/PdfEnhancer";
import ResizeImage from "@/components/ResizeImage";
import ResizePdf from "@/components/ResizePdf";
import { useState } from "react";
import { Image as ImageIcon, FileText, Maximize2, FileCode2 } from "lucide-react";

const queryClient = new QueryClient();

const TABS = [
  { id: "image", label: "Image Enhancer", icon: ImageIcon },
  { id: "pdf", label: "PDF Enhancer", icon: FileText },
  { id: "resize-image", label: "Resize Image", icon: Maximize2 },
  { id: "resize-pdf", label: "Resize PDF", icon: FileCode2 },
] as const;

type TabId = typeof TABS[number]["id"];

function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("image");

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center px-4 py-6 md:p-8 overflow-x-hidden relative">
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/30 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-5xl mx-auto mb-8 relative z-10 pt-4 md:pt-8">
        <div className="relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/60 to-transparent z-10 rounded-r-full md:hidden" />
          <div className="flex bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-xl overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 md:px-6 rounded-full text-xs md:text-sm font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                  activeTab === id
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-purple-500/25"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "image" && <ImageEnhancer />}
      {activeTab === "pdf" && <PdfEnhancer />}
      {activeTab === "resize-image" && <ResizeImage />}
      {activeTab === "resize-pdf" && <ResizePdf />}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
