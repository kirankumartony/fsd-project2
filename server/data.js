export const dataStore = {
  transactions: [
    { id: 1, date: 'Apr 19', merchant: 'Payroll deposit', category: 'Income', type: 'Income', amount: 4800 },
    { id: 2, date: 'Apr 19', merchant: 'Utility refund', category: 'Income', type: 'Income', amount: 42 },
    { id: 3, date: 'Apr 18', merchant: 'Whole Foods', category: 'Groceries', type: 'Expense', amount: -126 },
    { id: 4, date: 'Apr 18', merchant: 'Rent', category: 'Housing', type: 'Expense', amount: -1450 },
    { id: 5, date: 'Apr 17', merchant: 'Spotify', category: 'Subscriptions', type: 'Expense', amount: -15 },
    { id: 6, date: 'Apr 16', merchant: 'City Transit', category: 'Transport', type: 'Expense', amount: -42 },
    { id: 7, date: 'Apr 15', merchant: 'Target', category: 'Shopping', type: 'Expense', amount: -86 },
    { id: 8, date: 'Apr 14', merchant: 'Cafe Luna', category: 'Dining out', type: 'Expense', amount: -24 },
    { id: 9, date: 'Apr 13', merchant: 'Consulting invoice', category: 'Income', type: 'Income', amount: 1200 },
    { id: 10, date: 'Apr 12', merchant: 'Gas station', category: 'Transport', type: 'Expense', amount: -58 },
    { id: 11, date: 'Apr 11', merchant: 'Pharmacy', category: 'Health', type: 'Expense', amount: -31 },
    { id: 12, date: 'Apr 10', merchant: 'Movie tickets', category: 'Entertainment', type: 'Expense', amount: -46 },
    { id: 13, date: 'Apr 08', merchant: 'Apple Store', category: 'Tech', type: 'Expense', amount: -299 },
    { id: 14, date: 'Apr 07', merchant: 'Savings transfer', category: 'Transfers', type: 'Expense', amount: -400 },
  ],
  budgets: [
    { category: 'Groceries', spent: 612, limit: 750, note: 'Latest 3: Whole Foods, Trader Joe, Market Basket' },
    { category: 'Dining out', spent: 338, limit: 400, note: 'Latest 3: Cafe Luna, Sushi House, Tacos 4U' },
    { category: 'Transport', spent: 121, limit: 180, note: 'Latest 3: City Transit, Gas station, Parking' },
    { category: 'Entertainment', spent: 74, limit: 150, note: 'Latest 3: Movie tickets, Concert stream, Arcade' },
  ],
  pots: [
    { name: 'Emergency fund', saved: 8200, goal: 12000, cadence: 'Monthly auto-transfer' },
    { name: 'Vacation', saved: 2650, goal: 4000, cadence: 'Bi-weekly top-up' },
    { name: 'New laptop', saved: 1380, goal: 2000, cadence: 'Manual deposits' },
  ],
  bills: [
    { name: 'Internet', due: 'Apr 22', status: 'Upcoming', amount: 79 },
    { name: 'Electricity', due: 'Apr 24', status: 'Scheduled', amount: 112 },
    { name: 'Insurance', due: 'Apr 28', status: 'Paid', amount: 184 },
  ],
}
