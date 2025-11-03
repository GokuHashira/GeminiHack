import { useState, useEffect } from "react";
import { Receipt, Calendar, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface ExpenseItem {
  id: string;
  description: string;
  amount_cents: number;
  expense_time: string | null;
  uploaded_by: string;
  participant_count: number;
}

export const BillHistory = () => {
  const [bills, setBills] = useState<ExpenseItem[]>([]);
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

      // Strategy: run two queries against expenses and merge results
      const qBase = `
          id,
          description,
          amount_cents,
          expense_time,
          uploaded_by,
          splits ( member_id )
        `;

      const [{ data: createdBy, error: e1 }] = await Promise.all([
        supabase.from('expenses').select(qBase).eq('uploaded_by', user.id).order('created_at', { ascending: false }).limit(20),
      ]);

      const splitIdsRes = await supabase.from('splits').select('expense_id').eq('member_id', user.id);
      const participantIds = (splitIdsRes.data || []).map((r: any) => r.expense_id);
      const { data: asParticipant, error: e2 } = participantIds.length
        ? await supabase.from('expenses').select(qBase).in('id', participantIds).order('created_at', { ascending: false }).limit(20)
        : { data: [], error: null as any };

      if (e1) { console.error('Error loading created bills:', e1); }
      if (e2) { console.error('Error loading participant bills:', e2); }

      const mergedMap: Record<string, any> = {};
      for (const row of [...(createdBy || []), ...(asParticipant || [])]) {
        mergedMap[row.id] = row;
      }
      const merged = Object.values(mergedMap) as any[];
      merged.sort((a, b) => new Date(b.expense_time || b.created_at).getTime() - new Date(a.expense_time || a.created_at).getTime());
      const top = merged.slice(0, 10);

      const formattedBills: ExpenseItem[] = top.map((exp: any) => ({
        id: exp.id,
        description: exp.description || 'Expense',
        amount_cents: exp.amount_cents,
        expense_time: exp.expense_time || null,
        uploaded_by: exp.uploaded_by,
        participant_count: exp.splits?.length ?? 0,
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
                    <h3 className="font-semibold text-foreground truncate">{bill.description}</h3>
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
                      <span>{(bill.amount_cents / 100).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(bill.expense_time || bill.created_at), { addSuffix: true })}
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
