import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useAppStore } from "../stores/app-store";
import { useProfileStore } from "../stores/profile-store";
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
  const { profiles, statuses, initialized, initialize, startProfile, stopProfile } = useProfileStore();

  useEffect(() => {
    if (!open || initialized) {
      return;
    }
    void initialize();
  }, [initialize, initialized, open]);

  const renderUpdateAction = () => {
    switch (updateState.status) {
      case "available":
        return (
          <Button onClick={() => void downloadUpdate()} className="w-full">
            Download update
          </Button>
        );
      case "downloaded":
        return (
          <Button onClick={() => void quitAndInstallUpdate()} className="w-full">
            Restart to install
          </Button>
        );
      case "downloading":
        return (
          <Button disabled className="w-full">
            Downloading {Math.round(updateState.downloadPercent ?? 0)}%
          </Button>
        );
      default:
        return (
          <Button onClick={() => void checkForUpdates()} className="w-full">
            Check for updates
          </Button>
        );
    }
  };

  const statusMessage = (() => {
    switch (updateState.status) {
      case "checking":
        return "Checking for updates...";
      case "available":
        return `Version ${updateState.availableVersion} is available to download.`;
      case "not-available":
        return "You are on the latest version.";
      case "downloading":
        return `Downloading version ${updateState.availableVersion}...`;
      case "downloaded":
        return `Version ${updateState.availableVersion} is ready to install.`;
      case "error":
        return updateState.message ?? "Update operation failed.";
      default:
        return updateState.message ?? "Automatic updates are ready.";
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3 border p-4">
            <div className="space-y-1">
              <div className="font-medium text-sm">Profile management</div>
              <p className="text-muted-foreground text-sm">
                {profiles.length > 0
                  ? `${profiles.length} provider profiles are configured.`
                  : "No provider profiles have been configured yet."}
              </p>
            </div>
            {profiles.length > 0 && (
              <div className="space-y-2">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center gap-2 p-2 border border-border"
                  >
                    <div className={cn("h-2 w-2 rounded-full flex-shrink-0",
                      statuses[profile.id]?.isRunning ? "bg-emerald-500" : "bg-muted-foreground/30"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{profile.name}</div>
                      <div className="text-xs text-muted-foreground">{profile.upstreamBaseUrl}</div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">:{profile.localPort}</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={async () => {
                        try {
                          if (statuses[profile.id]?.isRunning) {
                            await stopProfile(profile.id);
                          } else {
                            await startProfile(profile.id);
                          }
                        } catch (error) {
                          toast.error("Profile Error", {
                            description: error instanceof Error ? error.message : String(error),
                          });
                        }
                      }}
                    >
                      {statuses[profile.id]?.isRunning ? "Stop" : "Start"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3 border p-4">
            <div className="space-y-1">
              <div className="font-medium text-sm">Automatic updates</div>
              <div className="text-muted-foreground text-sm">
                {`Version ${updateState.currentVersion || "unknown"}`}
              </div>
              <p className="text-muted-foreground text-sm">{statusMessage}</p>
            </div>
            {renderUpdateAction()}
          </div>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
