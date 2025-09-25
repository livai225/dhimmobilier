-- Delete all data related to agent DH-HENRIETTE
-- Agent ID: 16750e3b-1797-41c4-ab67-bf220bd58bff

-- Step 1: Delete locations linked to DH-HENRIETTE's properties
DELETE FROM public.locations 
WHERE propriete_id IN (
  SELECT id FROM public.proprietes 
  WHERE agent_id = '16750e3b-1797-41c4-ab67-bf220bd58bff'
);

-- Step 2: Delete clients that only have relations with DH-HENRIETTE
-- (Clients who only have locations on DH-HENRIETTE's properties)
DELETE FROM public.clients 
WHERE id IN (
  -- Get clients who only have locations on DH-HENRIETTE's properties
  SELECT DISTINCT c.id
  FROM public.clients c
  JOIN public.locations l ON c.id = l.client_id
  JOIN public.proprietes p ON l.propriete_id = p.id
  WHERE p.agent_id = '16750e3b-1797-41c4-ab67-bf220bd58bff'
  AND NOT EXISTS (
    -- Exclude clients who have other locations/souscriptions with other agents
    SELECT 1 FROM public.locations l2 
    JOIN public.proprietes p2 ON l2.propriete_id = p2.id
    WHERE l2.client_id = c.id 
    AND p2.agent_id != '16750e3b-1797-41c4-ab67-bf220bd58bff'
    UNION
    SELECT 1 FROM public.souscriptions s2
    JOIN public.proprietes p3 ON s2.propriete_id = p3.id
    WHERE s2.client_id = c.id
    AND p3.agent_id != '16750e3b-1797-41c4-ab67-bf220bd58bff'
  )
);

-- Step 3: Delete properties managed by DH-HENRIETTE
DELETE FROM public.proprietes 
WHERE agent_id = '16750e3b-1797-41c4-ab67-bf220bd58bff';

-- Step 4: Delete the agent DH-HENRIETTE
DELETE FROM public.agents_recouvrement 
WHERE id = '16750e3b-1797-41c4-ab67-bf220bd58bff';