import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatInterface } from "@/components/ChatInterface";
import { Dashboard } from "@/components/Dashboard";
import { VoiceInput } from "@/components/VoiceInput";
import { BillParticipants } from "@/components/BillParticipants";
import { BillHistory } from "@/components/BillHistory";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  const DISABLE_AUTH = (import.meta as any).env?.VITE_DISABLE_AUTH === '1' || (import.meta as any).env?.VITE_DISABLE_AUTH === 'true';

  useEffect(() => {
    // Always read session to set user state, but do NOT redirect to /auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Render the page even when not authenticated; uploads will still require auth.

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto h-[calc(100vh-3rem)]">
        <div className="flex justify-end mb-4">
          {user ? (
            <Button onClick={handleSignOut} variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          ) : (
            <Button onClick={() => navigate('/auth')} variant="ghost" size="sm">
              Sign In
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          {/* Left Panel - Chat Interface (50%) */}
          <div className="h-full">
            <ChatInterface />
          </div>

          {/* Right Panel - Dashboard and Voice (50%) */}
          <div className="grid grid-rows-[auto_1fr_1fr_1fr] gap-4 h-full">
            {/* Bill Participants Widget */}
            <div>
              <BillParticipants />
            </div>
            
            {/* Dashboard */}
            <div className="h-full">
              <Dashboard />
            </div>

            {/* Bill History */}
            <div className="h-full">
              <BillHistory />
            </div>

            {/* Voice Input */}
            <div className="h-full">
              <VoiceInput />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
