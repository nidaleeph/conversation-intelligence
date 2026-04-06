import { useState } from "react";
import { requestMagicLink } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowRight, CheckCircle } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await requestMagicLink(email);
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1a1e23]">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <img
            src="/ddre-logo-white.svg"
            alt="DDRE Global"
            className="w-12 h-auto mx-auto mb-4 opacity-90"
          />
          <h1 className="text-xl font-semibold text-[#f1f2f7]">
            DDRE War Room
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Sign in to your account
          </p>
        </div>

        <div className="bg-[#22272d] rounded-xl border border-[#2a2f35] p-6">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 text-[#77d5c0] mx-auto mb-3" />
              <p className="text-[#f1f2f7] font-medium">Check your email</p>
              <p className="text-sm text-[#6b7280] mt-1">
                We sent a login link to{" "}
                <span className="text-[#77d5c0]">{email}</span>
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-sm text-[#77d5c0] mt-4 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-xs uppercase tracking-wider text-[#77d5c0] mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@ddre.com"
                  required
                  className="pl-10 bg-[#1a1e23] border-[#3a3f45] text-[#f1f2f7] placeholder:text-[#4b5563]"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 mt-2">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full mt-4 bg-[#77d5c0] text-[#1a1e23] hover:bg-[#5fc4ad] font-semibold"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-[#1a1e23] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Send Login Link
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="text-xs text-center text-[#4b5563] mt-6">
          Contact your admin if you don't have an account
        </p>
      </div>
    </div>
  );
}
