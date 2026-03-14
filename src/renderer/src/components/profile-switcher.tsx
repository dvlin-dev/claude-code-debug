import { useState } from "react";
import { useProfileStore } from "../stores/profile-store";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { ProfileForm } from "../features/profiles/profile-form";
import type { ConnectionProfile, ProviderId } from "../../../shared/contracts";

function providerTag(providerId: ProviderId): { label: string; className: string } {
  switch (providerId) {
    case "anthropic":
      return { label: "AN", className: "bg-accent-brand-muted text-accent-brand" };
    case "codex":
      return { label: "CX", className: "bg-success-muted text-success" };
  }
}

export function ProfileSwitcher() {
  const profiles = useProfileStore((s) => s.profiles);
  const statuses = useProfileStore((s) => s.statuses);
  const startProfile = useProfileStore((s) => s.startProfile);
  const stopProfile = useProfileStore((s) => s.stopProfile);
  const upsertProfile = useProfileStore((s) => s.upsertProfile);
  const deleteProfile = useProfileStore((s) => s.deleteProfile);

  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<ConnectionProfile | null>(null);

  if (profiles.length === 0) {
    return (
      <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
        No profiles configured
      </div>
    );
  }

  return (
    <>
      <div className="space-y-0.5">
        {profiles.map((profile) => (
          <ProfileRow
            key={profile.id}
            profile={profile}
            port={statuses[profile.id]?.port ?? profile.localPort}
            isRunning={statuses[profile.id]?.isRunning ?? false}
            onToggle={async () => {
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
            onEdit={() => setEditingProfile(profile)}
            onDelete={() => setDeletingProfile(profile)}
          />
        ))}
      </div>

      {/* Edit dialog */}
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

      {/* Delete confirmation dialog */}
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
    </>
  );
}

interface ProfileRowProps {
  profile: ConnectionProfile;
  port: number;
  isRunning: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProfileRow({ profile, port, isRunning, onToggle, onEdit, onDelete }: ProfileRowProps) {
  const [hovered, setHovered] = useState(false);
  const [rowHovered, setRowHovered] = useState(false);
  const tag = providerTag(profile.providerId);

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full shrink-0",
          isRunning ? "bg-success shadow-[0_0_4px_rgba(52,211,153,0.4)]" : "bg-muted-foreground/30",
        )}
      />
      <span className={cn("text-[11px] font-bold shrink-0 px-1", tag.className)}>
        {tag.label}
      </span>
      <span className="text-xs font-medium truncate flex-1">{profile.name}</span>

      {/* Edit / Delete — visible on row hover */}
      <span
        className={cn(
          "flex items-center gap-0.5 shrink-0 transition-opacity",
          rowHovered ? "opacity-100" : "opacity-0",
        )}
      >
        <button
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit profile"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
        <button
          className="p-0.5 text-muted-foreground hover:text-red-400 transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete profile"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </span>

      <span className="text-xs font-mono text-muted-foreground shrink-0">:{port}</span>
      <button
        className={cn(
          "text-xs px-1.5 py-0.5 border shrink-0 min-w-[50px] text-center transition-all",
          isRunning
            ? hovered
              ? "text-destructive border-destructive/30 bg-destructive/10"
              : "text-success border-success/25 bg-success-muted"
            : hovered
              ? "text-success border-success/25 bg-success-muted"
              : "text-muted-foreground border-border",
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onToggle}
      >
        {isRunning ? (hovered ? "Stop" : "Listening") : "Start"}
      </button>
    </div>
  );
}
