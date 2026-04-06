import { Bell, Mail, MessageSquare, Smartphone, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { agent } = useAuth();

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[#f1f2f7]">Settings</h1>
        <p className="text-xs text-[#6b7280] mt-0.5">Manage your account and notification preferences</p>
      </div>

      {/* Profile section */}
      <div className="bg-[#22272d] rounded-lg p-6 border border-[#2a2f35]">
        <h2 className="text-xs uppercase tracking-wider text-[#77d5c0] mb-4 font-semibold">Profile</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#77d5c0]/20 flex items-center justify-center">
              <User className="w-5 h-5 text-[#77d5c0]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#f1f2f7]">{agent?.name ?? "—"}</p>
              <p className="text-xs text-[#6b7280]">{agent?.email ?? "—"}</p>
            </div>
          </div>
          <div>
            <span className="text-xs text-[#6b7280]">Role: </span>
            <span className="text-xs font-semibold text-[#f1f2f7] uppercase">{agent?.role ?? "—"}</span>
          </div>
          <div>
            <span className="text-xs text-[#6b7280]">Coverage Areas: </span>
            <span className="text-xs text-[#f1f2f7]">
              {agent?.coverageAreas?.join(", ") || "None set"}
            </span>
          </div>
        </div>
      </div>

      {/* Notification preferences */}
      <div className="bg-[#22272d] rounded-lg p-6 border border-[#2a2f35]">
        <h2 className="text-xs uppercase tracking-wider text-[#77d5c0] mb-4 font-semibold">Notification Preferences</h2>
        <div className="space-y-4">
          {[
            { icon: Bell, label: "In-App Notifications", desc: "Real-time alerts in the War Room", enabled: true },
            { icon: Mail, label: "Email Notifications", desc: "Alert emails to your inbox", enabled: true },
            { icon: MessageSquare, label: "WhatsApp Notifications", desc: "Coming soon", enabled: false },
            { icon: Smartphone, label: "Push Notifications", desc: "Browser push notifications", enabled: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-[#6b7280]" />
                <div>
                  <p className="text-sm text-[#f1f2f7]">{item.label}</p>
                  <p className="text-[10px] text-[#6b7280]">{item.desc}</p>
                </div>
              </div>
              <div
                className={`w-9 h-5 rounded-full relative transition-all cursor-pointer ${
                  item.enabled ? "bg-[#77d5c0]" : "bg-[#3a3f45]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    item.enabled ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#4b5563] mt-4">
          Notification preferences are read-only for now — editable in a future update.
        </p>
      </div>
    </div>
  );
}
