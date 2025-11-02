import { useState } from "react";
import { Send, User, Bot, Plus, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: number;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  images?: string[];
}

export const ChatInterface = () => {
  const { toast } = useToast();
  const BUCKET_NAME = "geminihackbucket"; // Change to your Supabase Storage bucket name
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: "Hi there! Upload a bill image and I'll scan it for you, or just chat with me!",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{ path: string; url: string | null }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async () => {
    if (inputValue.trim() || selectedImages.length > 0) {
      const instructionText = inputValue.trim();
      setIsProcessing(true);
      
      // Convert images to base64
      const imageUrls: string[] = [];
      for (const file of selectedImages) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        imageUrls.push(await base64Promise);
      }

      const newMessage: Message = {
        id: messages.length + 1,
        type: "user",
        content: instructionText || "Please scan this bill",
        timestamp: new Date(),
        images: imageUrls,
      };
      
      setMessages(prev => [...prev, newMessage]);
      setInputValue("");
      const imagesToScan = [...selectedImages];
      setSelectedImages([]);
      setIsExpanded(false);
      
      // If images are present, process via FastAPI (now sending uploaded file path)
      if (imagesToScan.length > 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) throw new Error("Please sign in to process receipts.");

          let apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
          if (/^http:\/\/localhost\/?$/.test(apiBase) || /^http:\/\/127\.0\.0\.1\/?$/.test(apiBase)) {
            apiBase = "http://localhost:8000";
          }
          const form = new FormData();
          // send only the first uploaded path for now
          const first = uploadedFiles[0];
          if (!first?.path) {
            throw new Error("Please upload the receipt first.");
          }
          toast({ title: "Processing receipt", description: `file_path: ${first.path}` });
          console.debug("Processing file_path:", first.path, "instruction:", instructionText);
          form.append("file_path", first.path);
          form.append("split_instruction", instructionText || "Split evenly among participants.");
          const { data: { session: sess } } = await supabase.auth.getSession();
          if (!sess?.user?.id) throw new Error("Missing user session");
          form.append("current_user_id", sess.user.id);

          const res = await fetch(`${apiBase}/process-stored-bill/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.detail || `Processing failed (${res.status})`);
          }

          const json = await res.json();

          setMessages(prev => [...prev, {
            id: prev.length + 1,
            type: "bot",
            content: `Receipt processed. File uploaded. URL: ${json.file?.url || "(private)"}`,
            timestamp: new Date(),
          }]);
          // clear uploaded list after successful processing
          setUploadedFiles([]);
        } catch (err) {
          console.error('Exception scanning bill:', err);
          toast({
            title: "Error",
            description: err instanceof Error ? err.message : "An unexpected error occurred.",
            variant: "destructive",
          });
        }
      } else {
        // Regular text message
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: prev.length + 1,
            type: "bot",
            content: "I'll help you with that!",
            timestamp: new Date(),
          }]);
        }, 500);
      }
      
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const inputEl = e.currentTarget;
    const files = Array.from(e.target.files);

    // keep local previews
    setSelectedImages(prev => [...prev, ...files]);
    // upload immediately to Supabase, then send path to backend on Send
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Please sign in to upload.");
      const userId = session.user.id;

      const uploads = await Promise.all(files.map(async (file) => {
        const ext = file.name.split(".").pop() ?? "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const filePath = `${userId}/receipts/${fileName}`;
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
        return { path: filePath, url: data.publicUrl as string };
      }));

      setUploadedFiles(prev => [...prev, ...uploads]);
      console.debug("Uploaded files:", uploads);
      const firstPath = uploads[0]?.path;
      toast({ title: "Uploaded", description: `${uploads.length} file(s). First path: ${firstPath}` });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: err?.message || "Could not upload file(s)", variant: "destructive" });
    } finally {
      // reset input value so same files can be reselected if needed
      inputEl.value = "";
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full bg-chat-bg rounded-3xl p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-chat-fg">Chat</h2>
      </div>

      <ScrollArea className="flex-1 pr-4 mb-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.type === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  message.type === "user"
                    ? "bg-chat-user"
                    : "bg-chat-bot"
                }`}
              >
                {message.type === "user" ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-white" />
                )}
              </div>
              <div
                className={`flex-1 px-4 py-3 rounded-2xl max-w-[80%] ${
                  message.type === "user"
                    ? "bg-chat-user text-white"
                    : "bg-chat-bot text-chat-fg"
                }`}
              >
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {message.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Bill ${idx + 1}`}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="space-y-3">
        {selectedImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedImages.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Bill ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="relative">
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="ghost"
              size="icon"
              className="rounded-full bg-chat-input hover:bg-chat-input/80 transition-all duration-200"
            >
              <Plus className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-45' : ''}`} />
            </Button>
            
            {isExpanded && (
              <div className="absolute bottom-full left-0 mb-2 bg-chat-input rounded-2xl p-2 shadow-lg animate-in slide-in-from-bottom-2 fade-in">
                <label htmlFor="bill-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 hover:bg-accent rounded-xl transition-colors text-white">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">Upload Bill</span>
                  </div>
                </label>
                <input
                  id="bill-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-chat-input border-none text-chat-fg placeholder:text-muted-foreground rounded-2xl"
          />
          <Button
            onClick={handleSend}
            disabled={isProcessing}
            className="bg-primary hover:bg-primary/90 rounded-2xl px-6"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
