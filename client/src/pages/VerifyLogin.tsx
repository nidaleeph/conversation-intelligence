import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { verifyMagicLink } from "@/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, XCircle } from "lucide-react";

export default function VerifyLogin() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { refresh } = useAuth();
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");

    if (!token) {
      setError("No token provided");
      setVerifying(false);
      return;
    }

    verifyMagicLink(token)
      .then(async () => {
        await refresh();
        setLocation("/");
      })
      .catch(() => {
        setError("This link is invalid or has expired.");
        setVerifying(false);
      });
  }, [search, setLocation, refresh]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1a1e23]">
      <div className="text-center">
        {verifying ? (
          <>
            <div className="w-8 h-8 border-2 border-[#77d5c0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#f1f2f7]">Verifying your login...</p>
          </>
        ) : error ? (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-[#f1f2f7] font-medium">Login failed</p>
            <p className="text-sm text-[#6b7280] mt-1">{error}</p>
            <a
              href="/login"
              className="inline-block mt-4 text-sm text-[#77d5c0] hover:underline"
            >
              Back to login
            </a>
          </>
        ) : (
          <>
            <CheckCircle className="w-10 h-10 text-[#77d5c0] mx-auto mb-3" />
            <p className="text-[#f1f2f7]">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}
