import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useAppStore } from "../stores/app-store";
import { useProfileStore } from "../stores/profile-store";
import { ProfileForm } from "../features/profiles/profile-form";
import { cn } from "../lib/utils";
import { toast } from "sonner";

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
  const { profiles, statuses, initialized, initialize, startProfile, stopProfile, upsertProfile } =
    useProfileStore();
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (!open || initialized) return;
    void initialize();
  }, [initialize, initialized, open]);

  useEffect(() => {
    if (!open) {
      setShowAddForm(false);
    }
  }, [open]);

  const updateButton = (() => {
    switch (updateState.status) {
      case "available":
        return <Button size="xs" onClick={() => void downloadUpdate()}>Download</Button>;
      case "downloaded":
        return <Button size="xs" onClick={() => void quitAndInstallUpdate()}>Restart</Button>;
      case "downloading":
        return <Button size="xs" disabled>Downloading {Math.round(updateState.downloadPercent ?? 0)}%</Button>;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{showAddForm ? "Add Profile" : "Settings"}</DialogTitle>
        </DialogHeader>

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
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Profiles
              </div>
              <div className="space-y-1">
                {profiles.map((profile) => {
                  const isRunning = statuses[profile.id]?.isRunning ?? false;
                  return (
                    <div
                      key={profile.id}
                      className="flex items-center gap-2 border border-border p-2"
                    >
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full flex-shrink-0",
                          isRunning ? "bg-emerald-500" : "bg-muted-foreground/30",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">{profile.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {profile.upstreamBaseUrl}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                        :{profile.localPort}
                      </span>
                      <Button
                        variant={isRunning ? "destructive" : "outline"}
                        size="xs"
                        onClick={async () => {
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
                      >
                        {isRunning ? "Stop" : "Start"}
                      </Button>
                    </div>
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
                ＋ Add Profile
              </button>
            </div>

            {/* Updates Section */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Updates
              </div>
              <div className="flex items-center gap-3 border border-border p-2.5">
                <div className="flex-1">
                  <div className="text-xs font-medium">
                    Version {updateState.currentVersion || "unknown"}
                  </div>
                  {statusMessage && (
                    <div className="text-[10px] text-muted-foreground">{statusMessage}</div>
                  )}
                </div>
                {updateButton}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
