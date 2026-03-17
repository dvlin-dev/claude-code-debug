import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useProfileStore } from "../stores/profile-store";
import { ProviderBadge } from "../features/profiles/components/provider-badge";
import { ProfileSwitcher } from "./profile-switcher";
import { ProfileForm } from "../features/profiles/profile-form";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { cn } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { toast } from "sonner";

const MAX_VISIBLE = 5;

export function ProfileDropdown() {
  const profiles = useProfileStore((s) => s.profiles);
  const statuses = useProfileStore((s) => s.statuses);
  const upsertProfile = useProfileStore((s) => s.upsertProfile);
  const [addOpen, setAddOpen] = useState(false);

  const visible = profiles.slice(0, MAX_VISIBLE);
  const overflow = profiles.length - MAX_VISIBLE;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="no-drag flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors outline-none select-none"
          >
            {visible.length === 0 ? (
              <span className="text-muted-foreground">No profiles</span>
            ) : (
              visible.map((profile) => {
                const isRunning = statuses[profile.id]?.isRunning ?? false;
                return (
                  <span key={profile.id} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        isRunning
                          ? "bg-success shadow-[0_0_5px_rgba(34,197,94,0.6)]"
                          : "bg-muted-foreground/30",
                      )}
                    />
                    <ProviderBadge providerId={profile.providerId} />
                  </span>
                );
              })
            )}
            {overflow > 0 && (
              <span className="text-[10px] text-muted-foreground">+{overflow}</span>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-auto min-w-0 p-0"
        >
          <ScrollArea className="max-h-[400px]">
            <div className="p-2">
              <ProfileSwitcher />
            </div>
          </ScrollArea>
          <DropdownMenuSeparator className="my-0" />
          <div className="p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Profile
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <ProfileForm
            submitLabel="Create profile"
            onSubmit={async (profile) => {
              await upsertProfile(profile);
              setAddOpen(false);
              toast.success("Profile created");
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
