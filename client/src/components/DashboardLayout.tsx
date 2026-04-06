// ============================================================
// DDRE War Room — Dashboard Layout
// Dark sidebar (60px icon rail), teal active indicator, LIVE pulse
// ============================================================

import { ReactNode, useState } from "react";
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
  LogOut,
  Menu,
  Shield,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadAlertCount } from "@/hooks/queries/useAlerts";
import { useWebSocketEvent } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCallback } from "react";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { agent, logout } = useAuth();

  const allNavItems = agent?.role === "admin"
    ? [...navItems, { path: "/admin", label: "Admin", icon: Shield }]
    : navItems;
  const { data: unreadData } = useUnreadAlertCount();
  const unreadCount = unreadData?.count ?? 0;

  const queryClient = useQueryClient();
  useWebSocketEvent("alert:new", useCallback((data: any) => {
    toast(data.summary, {
      description: `Priority: ${data.priority}`,
      duration: 8000,
    });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  }, [queryClient]));

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1e23]">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-[60] w-8 h-8 flex items-center justify-center rounded-lg bg-[#22272d] text-[#6b7280] hover:text-white"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`w-[60px] flex flex-col items-center py-4 bg-[#16191e] border-r border-[#2a2f35] shrink-0 fixed md:relative z-50 h-full transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
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
          {allNavItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            const isLive = item.path === "/live";
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.path}
                    onClick={() => setSidebarOpen(false)}
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
                    {item.path === "/alerts" && unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
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

        {/* User section */}
        <div className="mt-auto pb-2 flex flex-col items-center gap-1">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={logout}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-[#6b7280] hover:text-[#9ca3af] hover:bg-[#22272d] transition-all duration-200"
              >
                <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[#22272d] text-[#f1f2f7] border-[#3a3f45] text-xs">
              Sign Out
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
