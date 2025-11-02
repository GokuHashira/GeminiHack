import { useState, useEffect } from "react";
import { Receipt, Calendar, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Bill {
  id: string;
  title: string;
  total_amount: number;
  merchant: string | null;
  bill_date: string | null;
  created_at: string;
  created_by: string;
  creator_username: string;
  participant_count: number;
}

export const BillHistory = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBills();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('bill-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bills'
        },
        () => {
          loadBills();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadBills = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get bills where user is creator or participant
      const { data: billsData, error } = await supabase
        .from('bills')
        .select(`
          id,
          title,
          total_amount,
          merchant,
          bill_date,
          created_at,
          created_by,
          profiles!bills_created_by_fkey (
            username
          ),
          bill_participants (
            id
          )
        `)
        .or(`created_by.eq.${user.id},bill_participants.user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading bills:', error);
        return;
      }

      const formattedBills: Bill[] = billsData.map((bill: any) => ({
        id: bill.id,
        title: bill.title,
        total_amount: bill.total_amount,
        merchant: bill.merchant,
        bill_date: bill.bill_date,
        created_at: bill.created_at,
        created_by: bill.created_by,
        creator_username: bill.profiles.username,
        participant_count: bill.bill_participants.length,
      }));

      setBills(formattedBills);
    } catch (err) {
      console.error('Exception loading bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (index: number) => {
    const colors = [
      "bg-expense-red",
      "bg-expense-orange",
      "bg-expense-blue",
      "bg-expense-green",
      "bg-expense-purple",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="flex flex-col h-full bg-dashboard-bg rounded-3xl p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">Bill History</h2>
          <Receipt className="w-5 h-5 text-primary" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No bills yet. Start by creating your first bill!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bills.map((bill, index) => (
              <Card
                key={bill.id}
                className="p-4 bg-dashboard-card border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${getCategoryColor(index)} flex items-center justify-center flex-shrink-0`}>
                    <Receipt className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{bill.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>by {bill.creator_username}</span>
                      <span>•</span>
                      <span>{bill.participant_count} participant{bill.participant_count !== 1 ? 's' : ''}</span>
                    </div>
                    {bill.bill_date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(bill.bill_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 font-bold text-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>{bill.total_amount.toFixed(2)}</span>
                    </div>
                    {bill.merchant && (
                      <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {bill.merchant}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(bill.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
