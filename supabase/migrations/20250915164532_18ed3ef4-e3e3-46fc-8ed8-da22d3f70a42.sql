-- Add agent_id column to proprietes table for recovery tracking
ALTER TABLE public.proprietes 
ADD COLUMN agent_id UUID REFERENCES public.agents_recouvrement(id);

-- Add index for better performance when filtering by agent
CREATE INDEX idx_proprietes_agent_id ON public.proprietes(agent_id);

-- Add comment to document the purpose
COMMENT ON COLUMN public.proprietes.agent_id IS 'Agent de recouvrement responsable de cette propriété';