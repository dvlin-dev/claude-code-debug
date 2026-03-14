import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { useProfileStore } from "../stores/profile-store";

export function ListeningToggle() {
  const profiles = useProfileStore((state) => state.profiles);
  const statuses = useProfileStore((state) => state.statuses);
  const startProfile = useProfileStore((state) => state.startProfile);
  const stopProfile = useProfileStore((state) => state.stopProfile);
  const firstProfile = profiles[0] ?? null;
  const isListening = firstProfile
    ? (statuses[firstProfile.id]?.isRunning ?? false)
    : false;

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={isListening}
        onCheckedChange={() => {
          if (!firstProfile) return;
          void (isListening
            ? stopProfile(firstProfile.id)
            : startProfile(firstProfile.id));
        }}
        aria-label="Toggle primary profile listening"
      />
      <Badge variant={isListening ? "default" : "secondary"}>
        {isListening ? "Listening" : "Off"}
      </Badge>
    </div>
  );
}
