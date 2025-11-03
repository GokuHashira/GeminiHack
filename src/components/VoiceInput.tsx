import { useState, useEffect } from "react";
import { Mic, MicOff, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const VoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showApproval, setShowApproval] = useState(false);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(20).fill(0.3));

  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setWaveformBars(
          Array.from({ length: 20 }, () => Math.random() * 0.8 + 0.2)
        );
      }, 100);
      return () => clearInterval(interval);
    } else {
      setWaveformBars(Array(20).fill(0.3));
    }
  }, [isRecording]);

  const handleToggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTranscript("");
      setShowApproval(false);
      toast.success("Recording started");
      
      // Simulate transcription after 3 seconds
      setTimeout(() => {
        setIsRecording(false);
        setTranscript("Add $50 for dinner split equally among 4 people");
        setShowApproval(true);
      }, 3000);
    } else {
      setIsRecording(false);
      toast.info("Recording stopped");
    }
  };

  const handleApprove = () => {
    toast.success("Expense request sent to group!");
    setShowApproval(false);
    setTranscript("");
  };

  const handleReject = () => {
    toast.error("Transcript rejected");
    setShowApproval(false);
    setTranscript("");
  };

  return (
    <div className="flex flex-col h-full bg-voice-bg rounded-3xl p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Voice Input</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* Waveform Visualization */}
        <div className="flex items-center justify-center gap-1 h-24">
          {waveformBars.map((height, index) => (
            <div
              key={index}
              className={`w-1.5 rounded-full transition-all duration-100 ${
                isRecording ? "bg-voice-waveform" : "bg-muted"
              }`}
              style={{
                height: `${height * 100}%`,
                opacity: isRecording ? 1 : 0.3,
              }}
            />
          ))}
        </div>

        {/* Microphone Button */}
        <Button
          onClick={handleToggleRecording}
          className={`w-20 h-20 rounded-full transition-all ${
            isRecording
              ? "bg-destructive hover:bg-destructive/90 scale-110"
              : "bg-voice-active hover:bg-voice-active/90"
          }`}
        >
          {isRecording ? (
            <MicOff className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </Button>

        <p className="text-sm text-muted-foreground">
          {isRecording ? "Recording..." : "Tap to record"}
        </p>
      </div>

      {/* Transcript Display */}
      {transcript && (
        <Card className="p-4 bg-card border-none shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <p className="text-sm text-foreground mb-4">{transcript}</p>
          
          {showApproval && (
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                className="flex-1 bg-accent hover:bg-accent/90 gap-2"
              >
                <Check className="w-4 h-4" />
                Approve
              </Button>
              <Button
                onClick={handleReject}
                variant="outline"
                className="flex-1 gap-2"
              >
                <X className="w-4 h-4" />
                Reject
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
