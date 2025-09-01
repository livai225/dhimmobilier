-- Enable real-time updates for cash_transactions table
ALTER TABLE public.cash_transactions REPLICA IDENTITY FULL;

-- Add the table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_transactions;