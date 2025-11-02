import { useState, useEffect } from "react";
import { Users, X, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Participant {
  id: string;
  username: string;
  avatar_url?: string;
}

interface BillParticipantsProps {
  billId?: string;
  onParticipantsChange?: (participants: Participant[]) => void;
}

export const BillParticipants = ({ billId, onParticipantsChange }: BillParticipantsProps) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Participant[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (billId) {
      loadParticipants();
    }
  }, [billId]);

  useEffect(() => {
    if (onParticipantsChange) {
      onParticipantsChange(participants);
    }
  }, [participants, onParticipantsChange]);

  const loadParticipants = async () => {
    if (!billId) return;

    const { data, error } = await supabase
      .from("bill_participants")
      .select(`
        user_id,
        profiles!bill_participants_user_id_fkey (
          id,
          username,
          avatar_url
        )
      `)
      .eq("bill_id", billId);

    if (error) {
      console.error("Error loading participants:", error);
      return;
    }

    const participantsList = data.map((p: any) => ({
      id: p.profiles.id,
      username: p.profiles.username,
      avatar_url: p.profiles.avatar_url,
    }));

    setParticipants(participantsList);
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${query}%`)
      .limit(5);

    if (error) {
      console.error("Error searching users:", error);
      return;
    }

    // Filter out already added participants
    const filtered = data.filter(
      (user) => !participants.some((p) => p.id === user.id)
    );

    setSearchResults(filtered);
  };

  const addParticipant = async (user: Participant) => {
    if (billId) {
      const { error } = await supabase
        .from("bill_participants")
        .insert({
          bill_id: billId,
          user_id: user.id,
        });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to add participant",
          variant: "destructive",
        });
        return;
      }
    }

    setParticipants([...participants, user]);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  };

  const removeParticipant = async (userId: string) => {
    if (billId) {
      const { error } = await supabase
        .from("bill_participants")
        .delete()
        .eq("bill_id", billId)
        .eq("user_id", userId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to remove participant",
          variant: "destructive",
        });
        return;
      }
    }

    setParticipants(participants.filter((p) => p.id !== userId));
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (username: string) => {
    const colors = [
      "bg-expense-red",
      "bg-expense-orange",
      "bg-expense-blue",
      "bg-expense-green",
      "bg-expense-purple",
    ];
    const index = username.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <Card className="p-4 bg-dashboard-card border-none shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Participants</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSearch(!showSearch)}
          className="rounded-full"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {showSearch && (
        <div className="mb-4">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchUsers(e.target.value);
            }}
            className="mb-2"
          />
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => addParticipant(user)}
                  className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg cursor-pointer"
                >
                  <Avatar className="w-8 h-8">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} />
                    ) : (
                      <AvatarFallback className={`${getAvatarColor(user.username)} text-white text-xs`}>
                        {getInitials(user.username)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="text-sm">{user.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center gap-3 p-3 bg-background/50 rounded-lg group"
          >
            <Avatar className="w-10 h-10">
              {participant.avatar_url ? (
                <img src={participant.avatar_url} alt={participant.username} />
              ) : (
                <AvatarFallback className={`${getAvatarColor(participant.username)} text-white`}>
                  {getInitials(participant.username)}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="flex-1 font-medium text-foreground">
              {participant.username}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeParticipant(participant.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {participants.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No participants yet. Add someone to split the bill!
          </p>
        )}
      </div>
    </Card>
  );
};
