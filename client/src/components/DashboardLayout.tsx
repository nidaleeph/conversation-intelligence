// ============================================================
// DDRE War Room — Dashboard Layout
// Dark sidebar (60px icon rail), teal active indicator, LIVE pulse
// ============================================================

import { ReactNode } from "react";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  FileText,
  Activity,
  Bell,
  Radio,
  MapPin,
  Users,
  Settings,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/parser", label: "Parser", icon: FileText },
  { path: "/live", label: "Live Feed", icon: Activity },
  { path: "/alerts", label: "Alerts", icon: Bell },
  { path: "/signals", label: "Signals", icon: Radio },
  { path: "/areas", label: "Areas", icon: MapPin },
  { path: "/agents", label: "Agents", icon: Users },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1e23]">
      {/* Sidebar */}
      <aside className="w-[60px] flex flex-col items-center py-4 bg-[#16191e] border-r border-[#2a2f35] shrink-0">
        {/* DDRE Logo */}
        <Link href="/" className="mb-8 mt-1">
          <img
            src="/ddre-logo-white.svg"
            alt="DDRE Global"
            className="w-9 h-auto opacity-90 hover:opacity-100 transition-opacity"
          />
        </Link>

        {/* Nav Items */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            const isLive = item.path === "/live";
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.path}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 group ${
                      isActive
                        ? "text-[#77d5c0] bg-[#77d5c0]/10"
                        : "text-[#6b7280] hover:text-[#9ca3af] hover:bg-[#22272d]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[#77d5c0] rounded-r" />
                    )}
                    <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                    {isLive && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#2ecc71] animate-live-pulse" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#22272d] text-[#f1f2f7] border-[#3a3f45] text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* LIVE indicator */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2ecc71] animate-live-pulse" />
            <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[#6b7280]">
              Live
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
