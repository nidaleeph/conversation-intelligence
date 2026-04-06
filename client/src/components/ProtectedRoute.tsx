import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({
  children,
}: {
  children: ReactNode;
}) {
  const { agent, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1a1e23]">
        <div className="w-6 h-6 border-2 border-[#77d5c0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
