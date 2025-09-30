-- Drop the old 6-parameter version of pay_droit_terre_with_cash function
-- to resolve function overload conflict
DROP FUNCTION IF EXISTS public.pay_droit_terre_with_cash(uuid, numeric, date, text, text, text);