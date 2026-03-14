import { useProfileStore } from "../stores/profile-store";

export function ProxyInstructions() {
  const profiles = useProfileStore((state) => state.profiles);
  const statuses = useProfileStore((state) => state.statuses);
  const runningProfile = profiles.find((profile) => statuses[profile.id]?.isRunning);
  const proxyAddress = runningProfile
    ? `http://127.0.0.1:${statuses[runningProfile.id]?.port ?? runningProfile.localPort}`
    : null;

  if (!proxyAddress) return null;

  return (
    <div className="border bg-muted/50 p-4 text-sm space-y-2">
      <p className="font-medium">Connect Your Agent</p>
      <p className="text-muted-foreground">
        Configure your local agent client to use this proxy address:
      </p>
      <code className="block bg-background px-3 py-2 font-mono text-xs">
        {proxyAddress}
      </code>
    </div>
  );
}
