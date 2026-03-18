import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useAppStore } from "../stores/app-store";
import { useProfileStore } from "../stores/profile-store";
import { useSessionStore } from "../stores/session-store";
import { useTraceStore } from "../stores/trace-store";
import { ProfileForm } from "../features/profiles/profile-form";
import { cn } from "../lib/utils";
import { getElectronAPI } from "../lib/electron-api";
import { toast } from "sonner";
import { Github, ExternalLink, Trash2, Sparkles, Pencil, Download, Upload } from "lucide-react";
import type { ConnectionProfile } from "../../../shared/contracts";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    updateState,
    checkForUpdates,
    downloadUpdate,
    quitAndInstallUpdate,
  } = useAppStore();
  const {
    profiles,
    statuses,
    initialized,
    initialize,
    startProfile,
    stopProfile,
    upsertProfile,
    deleteProfile,
    setProfiles,
    setStatuses,
  } =
    useProfileStore();
  const clearHistory = useSessionStore((s) => s.clearHistory);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const resetSessions = useSessionStore((s) => s.reset);
  const clearTrace = useTraceStore((s) => s.clear);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<ConnectionProfile | null>(null);

  useEffect(() => {
    if (!open || initialized) return;
    void initialize();
  }, [initialize, initialized, open]);

  useEffect(() => {
    if (!open) {
      setShowAddForm(false);
      return;
    }
    // Auto-check for updates every time settings is opened
    if (updateState.status !== "downloading") {
      void checkForUpdates();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateButton = (() => {
    switch (updateState.status) {
      case "available":
        return <Button size="xs" onClick={() => void downloadUpdate()}>Download</Button>;
      case "downloaded":
        return (
          <Button size="xs" className="bg-success text-white hover:bg-success/90" onClick={() => void quitAndInstallUpdate()}>
            Restart to Update
          </Button>
        );
      case "downloading":
        return <Button size="xs" disabled>Downloading {Math.round(updateState.downloadPercent ?? 0)}%</Button>;
      case "checking":
        return <Button variant="outline" size="xs" disabled>Checking...</Button>;
      default:
        return <Button variant="outline" size="xs" onClick={() => void checkForUpdates()}>Check</Button>;
    }
  })();

  const statusMessage = (() => {
    switch (updateState.status) {
      case "checking": return "Checking…";
      case "available": return `v${updateState.availableVersion} available`;
      case "not-available": return "Latest version";
      case "downloading": return `Downloading v${updateState.availableVersion}…`;
      case "downloaded": return `v${updateState.availableVersion} ready`;
      case "error": return updateState.message ?? "Update failed";
      default: return "";
    }
  })();

  async function syncImportedState(): Promise<void> {
    const api = getElectronAPI();
    const [nextProfiles, nextStatuses] = await Promise.all([
      api.getProfiles(),
      api.getProfileStatuses(),
    ]);

    setProfiles(nextProfiles);
    setStatuses(nextStatuses);
    clearTrace();
    resetSessions();
    await loadSessions();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {!showAddForm && (
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
        )}

        {showAddForm ? (
          <ProfileForm
            onSubmit={async (profile) => {
              try {
                await upsertProfile(profile);
                setShowAddForm(false);
              } catch (error) {
                toast.error("Failed to save profile", {
                  description: error instanceof Error ? error.message : String(error),
                });
              }
            }}
            submitLabel="Add profile"
          />
        ) : (
          <div className="space-y-5">
            {/* Profiles Section */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Profiles
              </div>
              <div className="space-y-1">
                {profiles.map((profile) => {
                  const isRunning = statuses[profile.id]?.isRunning ?? false;
                  return (
                    <SettingsProfileRow
                      key={profile.id}
                      profile={profile}
                      isRunning={isRunning}
                      onEdit={() => setEditingProfile(profile)}
                      onDelete={() => setDeletingProfile(profile)}
                      onToggle={async () => {
                        try {
                          if (isRunning) {
                            await stopProfile(profile.id);
                          } else {
                            await startProfile(profile.id);
                          }
                        } catch (error) {
                          toast.error("Profile Error", {
                            description:
                              error instanceof Error ? error.message : String(error),
                          });
                        }
                      }}
                    />
                  );
                })}
              </div>
              {profiles.length === 0 && (
                <p className="text-xs text-muted-foreground">No profiles configured.</p>
              )}
              <button
                className="text-xs text-primary hover:underline mt-2"
                onClick={() => setShowAddForm(true)}
              >
                + Add Profile
              </button>
            </div>

            {/* Updates Section */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Updates
              </div>
              <div className="flex items-center gap-3 border border-border p-2.5 rounded-md">
                <div className="flex-1">
                  <div className="text-xs font-medium">
                    Version {updateState.currentVersion || "unknown"}
                  </div>
                  {statusMessage && (
                    <div className="text-[11px] text-muted-foreground">{statusMessage}</div>
                  )}
                </div>
                {updateButton}
              </div>
            </div>

            {/* Data Section */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Data
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      const result = await getElectronAPI().exportAppData();
                      if (!result) {
                        return;
                      }
                      toast.success("Data exported", {
                        description: `${result.profileCount} profiles, ${result.sessionCount} sessions, ${result.exchangeCount} exchanges`,
                      });
                    } catch (error) {
                      toast.error("Export failed", {
                        description: error instanceof Error ? error.message : String(error),
                      });
                    }
                  }}
                >
                  <Download className="h-3 w-3" />
                  Export data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    if (!window.confirm("Importing data will replace current profiles and history. Continue?")) {
                      return;
                    }

                    try {
                      const result = await getElectronAPI().importAppData();
                      if (!result) {
                        return;
                      }
                      await syncImportedState();
                      toast.success("Data imported", {
                        description: `${result.profileCount} profiles, ${result.sessionCount} sessions, ${result.exchangeCount} exchanges`,
                      });
                    } catch (error) {
                      toast.error("Import failed", {
                        description: error instanceof Error ? error.message : String(error),
                      });
                    }
                  }}
                >
                  <Upload className="h-3 w-3" />
                  Import data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (!window.confirm("This will permanently delete all captured history. Continue?")) {
                      return;
                    }
                    await clearHistory();
                    toast.success("History cleared");
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  Clear all history
                </Button>
              </div>
            </div>

            {/* Links Section */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Links
              </div>
              <div className="space-y-1.5">
                <button
                  className="flex items-center gap-2 w-full text-left border border-border p-2.5 hover:bg-muted/50 rounded-md transition-colors"
                  onClick={() => void window.electronAPI.openExternal("https://github.com/dvlin-dev/agent-trace")}
                >
                  <Github className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">Agent Trace</div>
                    <div className="text-[11px] text-muted-foreground">Star us on GitHub</div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
                <button
                  className="flex items-center gap-2 w-full text-left border border-accent-brand/30 bg-accent-brand-muted p-2.5 hover:bg-accent-brand/15 rounded-md transition-colors"
                  onClick={() => void window.electronAPI.openExternal("https://moryflow.com")}
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-accent-brand" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">Moryflow</div>
                    <div className="text-[11px] text-muted-foreground">Local-first AI Agent Workspace</div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-accent-brand shrink-0" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile Dialog */}
        <Dialog open={editingProfile !== null} onOpenChange={(open) => !open && setEditingProfile(null)}>
          <DialogContent>
            {editingProfile && (
              <ProfileForm
                initialProfile={editingProfile}
                submitLabel="Save"
                onSubmit={async (updated) => {
                  await upsertProfile(updated);
                  setEditingProfile(null);
                  toast.success("Profile updated");
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deletingProfile !== null} onOpenChange={(open) => !open && setDeletingProfile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deletingProfile?.name}?</DialogTitle>
              <DialogDescription>
                This will stop the proxy and remove this profile permanently.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!deletingProfile) return;
                  try {
                    if (statuses[deletingProfile.id]?.isRunning) {
                      await stopProfile(deletingProfile.id);
                    }
                    await deleteProfile(deletingProfile.id);
                    setDeletingProfile(null);
                    toast.success("Profile deleted");
                  } catch (error) {
                    toast.error("Delete failed", {
                      description: error instanceof Error ? error.message : String(error),
                    });
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

interface SettingsProfileRowProps {
  profile: ConnectionProfile;
  isRunning: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => Promise<void>;
}

function SettingsProfileRow({
  profile,
  isRunning,
  onEdit,
  onDelete,
  onToggle,
}: SettingsProfileRowProps) {
  const [rowHovered, setRowHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-2 border border-border p-2 rounded-md hover:bg-muted/40 transition-colors"
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
    >
      <div
        className={cn(
          "h-1.5 w-1.5 rounded-full flex-shrink-0",
          isRunning ? "bg-success" : "bg-muted-foreground/30",
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium">{profile.name}</div>
        <div className="text-[11px] text-muted-foreground font-mono truncate">
          {profile.upstreamBaseUrl}
        </div>
      </div>
      {rowHovered && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            title="Edit profile"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            className="p-0.5 text-muted-foreground hover:text-red-400 transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            title="Delete profile"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
      <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">
        :{profile.localPort}
      </span>
      <Button variant={isRunning ? "destructive" : "outline"} size="xs" onClick={() => void onToggle()}>
        {isRunning ? "Stop" : "Start"}
      </Button>
    </div>
  );
}
