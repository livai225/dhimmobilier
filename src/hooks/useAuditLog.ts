import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "./use-toast";

export interface AuditLogEntry {
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT';
  table_name: string;
  record_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  description?: string;
}

export const useAuditLog = () => {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const logAction = useMutation({
    mutationFn: async (entry: AuditLogEntry) => {
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: currentUser.id,
          action_type: entry.action_type,
          table_name: entry.table_name,
          record_id: entry.record_id || null,
          old_values: entry.old_values || null,
          new_values: entry.new_values || null,
          description: entry.description || null
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to log audit event:', error);
        throw error;
      }

      return data;
    },
    onError: (error) => {
      console.error('Audit log error:', error);
      // Don't show toast for audit failures to avoid UX disruption
    },
    onSuccess: () => {
      // Invalidate audit logs queries to refresh admin dashboard
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    }
  });

  const logCreate = (tableName: string, recordId: string, newValues: Record<string, any>, description?: string) => {
    logAction.mutate({
      action_type: 'CREATE',
      table_name: tableName,
      record_id: recordId,
      new_values: newValues,
      description: description || `Création d'un nouvel enregistrement dans ${tableName}`
    });
  };

  const logUpdate = (tableName: string, recordId: string, oldValues: Record<string, any>, newValues: Record<string, any>, description?: string) => {
    logAction.mutate({
      action_type: 'UPDATE',
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      description: description || `Modification d'un enregistrement dans ${tableName}`
    });
  };

  const logDelete = (tableName: string, recordId: string, oldValues: Record<string, any>, description?: string) => {
    logAction.mutate({
      action_type: 'DELETE',
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      description: description || `Suppression d'un enregistrement dans ${tableName}`
    });
  };

  const logView = (tableName: string, recordId?: string, description?: string) => {
    logAction.mutate({
      action_type: 'VIEW',
      table_name: tableName,
      record_id: recordId,
      description: description || `Consultation des données de ${tableName}`
    });
  };

  const logLogin = (description?: string) => {
    logAction.mutate({
      action_type: 'LOGIN',
      table_name: 'auth',
      description: description || 'Connexion utilisateur'
    });
  };

  const logLogout = (description?: string) => {
    logAction.mutate({
      action_type: 'LOGOUT', 
      table_name: 'auth',
      description: description || 'Déconnexion utilisateur'
    });
  };

  return {
    logCreate,
    logUpdate,
    logDelete,
    logView,
    logLogin,
    logLogout,
    isLogging: logAction.isPending
  };
};