import { createContext, useContext, ReactNode, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type AuthContextType = {
  user: any;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: 'doctor' | 'patient' | 'admin' | null;
  refreshAuth: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, refetch } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        role: user?.role as any || null,
        refreshAuth: refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: ReactNode; 
  allowedRoles?: ('doctor' | 'patient' | 'admin')[] 
}) {
  const { user, isLoading, isAuthenticated, role } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation("/login");
      } else if (allowedRoles && role && !allowedRoles.includes(role)) {
        // Redirect to their respective dashboard if they try to access wrong role path
        setLocation(`/${role === 'admin' ? 'admin' : role + '/dashboard'}`);
      }
    }
  }, [isLoading, isAuthenticated, role, allowedRoles, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || (allowedRoles && role && !allowedRoles.includes(role))) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
