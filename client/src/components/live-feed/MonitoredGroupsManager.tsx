import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, Users, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getMonitoredGroups,
  getLiveGroups,
  addMonitoredGroup,
  updateMonitoredGroup,
  deleteMonitoredGroup,
  type MonitoredGroupRow,
  type LiveGroup,
} from "@/api/whatsappWeb";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  /** Whether WhatsApp is currently connected (enables the "pick group" dropdown) */
  connected: boolean;
}

export function MonitoredGroupsManager({ connected }: Props) {
  const { agent } = useAuth();
  const isAdmin = agent?.role === "admin";

  const [groups, setGroups] = useState<MonitoredGroupRow[]>([]);
  const [liveGroups, setLiveGroups] = useState<LiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loadingLive, setLoadingLive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MonitoredGroupRow | null>(null);

  async function refreshGroups() {
    try {
      const data = await getMonitoredGroups();
      setGroups(data.groups);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshGroups();
    const interval = setInterval(refreshGroups, 5000);
    return () => clearInterval(interval);
  }, []);

  async function openAdd() {
    setAddOpen(true);
    setLoadingLive(true);
    try {
      const data = await getLiveGroups();
      setLiveGroups(data.groups);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to load live groups");
    } finally {
      setLoadingLive(false);
    }
  }

  async function handleAdd() {
    if (!selectedGroupId) return;
    const picked = liveGroups.find((g) => g.id === selectedGroupId);
    if (!picked) return;

    setActionBusy("add");
    setError(null);
    try {
      await addMonitoredGroup({
        groupChatId: picked.id,
        groupName: picked.name,
        enabled: true,
      });
      await refreshGroups();
      setAddOpen(false);
      setSelectedGroupId("");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to add group");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleToggle(group: MonitoredGroupRow) {
    setActionBusy(group.id);
    setError(null);
    try {
      await updateMonitoredGroup(group.id, { enabled: !group.enabled });
      await refreshGroups();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to update group");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setActionBusy(id);
    setError(null);
    try {
      await deleteMonitoredGroup(id);
      await refreshGroups();
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to delete group");
    } finally {
      setActionBusy(null);
    }
  }

  const alreadyAddedIds = new Set(groups.map((g) => g.groupChatId));
  const availableLive = liveGroups.filter((g) => !alreadyAddedIds.has(g.id));
  const isPermissive = groups.length === 0;

  return (
    <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Users className="w-4 h-4 text-[#77d5c0] shrink-0" />
          <div className="text-sm font-semibold text-white truncate">
            Monitored Groups
          </div>
          <div className="text-[11px] text-[#9ca3af] whitespace-nowrap">
            {isPermissive ? "(all groups)" : `(${groups.filter((g) => g.enabled).length} active)`}
          </div>
        </div>
        {isAdmin && connected && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] w-full md:w-auto"
            onClick={openAdd}
            disabled={actionBusy !== null}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add group
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {addOpen && (
        <div className="mb-3 p-3 bg-[#1a1e23] border border-[#3a3f45] rounded-lg">
          <div className="text-xs font-medium text-white mb-2">Select a group to monitor</div>
          {loadingLive ? (
            <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading groups from WhatsApp…
            </div>
          ) : availableLive.length === 0 ? (
            <div className="text-xs text-[#9ca3af]">
              No more groups to add — all groups this account is in are already monitored.
            </div>
          ) : (
            <>
              <select
                className="w-full bg-[#22272d] border border-[#3a3f45] rounded px-2 py-1.5 text-xs text-white mb-2"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="">Choose a group…</option>
                {availableLive.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={handleAdd}
                  disabled={!selectedGroupId || actionBusy === "add"}
                >
                  {actionBusy === "add" ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3 mr-1" />
                  )}
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setAddOpen(false);
                    setSelectedGroupId("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading…
        </div>
      ) : isPermissive ? (
        <div className="flex items-start gap-2 p-3 bg-[#1a1e23] border border-[#3a3f45] rounded">
          <Globe2 className="w-4 h-4 text-[#d4a843] shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-medium text-white">Monitoring all groups</div>
            <div className="text-[11px] text-[#9ca3af] mt-0.5">
              No allowlist configured — every group this account is in will be ingested.
              {isAdmin && connected && " Click \"Add group\" above to start an allowlist."}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {groups.map((g) => {
            const busy = actionBusy === g.id;
            return (
              <div
                key={g.id}
                className="flex items-center gap-3 p-2.5 bg-[#1a1e23] border border-[#3a3f45]/50 rounded"
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    g.enabled ? "text-[#77d5c0]" : "text-[#4a5060]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{g.groupName}</div>
                  <div className="text-[10px] text-[#9ca3af] flex items-center gap-2">
                    <span>{g.messageCount} message{g.messageCount === 1 ? "" : "s"}</span>
                    {g.lastSeenAt && (
                      <span>· last {new Date(g.lastSeenAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <>
                    <Switch
                      checked={g.enabled}
                      onCheckedChange={() => handleToggle(g)}
                      disabled={busy}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => setDeleteTarget(g)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove monitored group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop ingesting messages from{" "}
              <span className="text-white font-semibold">
                {deleteTarget?.groupName}
              </span>
              . Existing messages already in the war room will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy === deleteTarget?.id}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionBusy === deleteTarget?.id}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {actionBusy === deleteTarget?.id ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Removing…
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
