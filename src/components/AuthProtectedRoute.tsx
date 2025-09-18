import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '@/components/AuthProvider';

interface AuthProtectedRouteProps {
  children: React.ReactNode;
}

export function AuthProtectedRoute({ children }: AuthProtectedRouteProps) {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}