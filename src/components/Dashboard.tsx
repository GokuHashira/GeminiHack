import { Users, TrendingUp, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Expense {
  id: number;
  name: string;
  category: string;
  amount: number;
  paidBy: string;
  color: string;
}

const expenses: Expense[] = [
  { id: 1, name: "Groceries", category: "Food", amount: 563.50, paidBy: "Ignna", color: "bg-expense-red" },
  { id: 2, name: "Rent", category: "Housing", amount: 5789.24, paidBy: "Pat", color: "bg-expense-orange" },
  { id: 3, name: "Utilities", category: "Bills", amount: 515.20, paidBy: "Pat", color: "bg-expense-blue" },
  { id: 4, name: "Groceries", category: "Food", amount: 2447.05, paidBy: "Gadlis", color: "bg-expense-green" },
  { id: 5, name: "Entertainment", category: "Fun", amount: 445.00, paidBy: "morviyan", color: "bg-expense-purple" },
];

export const Dashboard = () => {
  const totalBalance = 96650;
  const yourShare = 44;

  return (
    <div className="flex flex-col h-full bg-dashboard-bg rounded-3xl p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">Balance</h2>
          <div className="flex gap-2">
            <div className="w-2 h-6 bg-foreground rounded"></div>
            <div className="w-2 h-6 bg-foreground rounded"></div>
            <div className="w-2 h-6 bg-foreground rounded"></div>
            <div className="w-2 h-6 bg-foreground rounded"></div>
            <div className="w-2 h-6 bg-foreground rounded"></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card className="p-4 bg-dashboard-card border-none shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold text-foreground">${totalBalance.toLocaleString()}</p>
          </Card>
          <Card className="p-4 bg-dashboard-card border-none shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Your Share</span>
            </div>
            <p className="text-2xl font-bold text-foreground">${yourShare.toFixed(2)}</p>
          </Card>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {expenses.map((expense) => (
            <Card
              key={expense.id}
              className="p-4 bg-dashboard-card border-none shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${expense.color} flex items-center justify-center flex-shrink-0`}>
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{expense.name}</h3>
                  <p className="text-xs text-muted-foreground">{expense.paidBy}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">${expense.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{expense.category}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
