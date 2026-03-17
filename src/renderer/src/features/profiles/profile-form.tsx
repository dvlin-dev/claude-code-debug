import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ConnectionProfile, ProviderId } from "../../../../shared/contracts";
import { DEFAULT_PROFILE_PORT_START } from "../../../../shared/defaults";
import { useProfileStore } from "../../stores/profile-store";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

const PROVIDER_OPTIONS: Array<{
  id: ProviderId;
  label: string;
  defaultUpstreamBaseUrl: string;
}> = [
  {
    id: "anthropic",
    label: "Anthropic",
    defaultUpstreamBaseUrl: "https://api.anthropic.com",
  },
  {
    id: "codex",
    label: "Codex",
    defaultUpstreamBaseUrl: "https://chatgpt.com/backend-api/codex",
  },
];

function getProviderOption(providerId: ProviderId) {
  return PROVIDER_OPTIONS.find((option) => option.id === providerId) ?? PROVIDER_OPTIONS[0]!;
}

function getDefaultName(providerId: ProviderId): string {
  return `${providerId}-dev`;
}

export interface ProfileFormProps {
  onSubmit: (profile: ConnectionProfile) => Promise<void>;
  initialProfile?: ConnectionProfile | null;
  submitLabel?: string;
}

export function ProfileForm({
  onSubmit,
  initialProfile = null,
  submitLabel = "Save profile",
}: ProfileFormProps) {
  const initialProvider = initialProfile?.providerId ?? "anthropic";
  const [providerId, setProviderId] = useState<ProviderId>(initialProvider);
  const [name, setName] = useState(initialProfile?.name ?? getDefaultName(initialProvider));
  const [upstreamBaseUrl, setUpstreamBaseUrl] = useState(
    initialProfile?.upstreamBaseUrl ?? getProviderOption(initialProvider).defaultUpstreamBaseUrl,
  );
  const [localPort, setLocalPort] = useState(initialProfile?.localPort ?? DEFAULT_PROFILE_PORT_START);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const profiles = useProfileStore((s) => s.profiles);
  const portConflict = profiles.some(
    (p) => p.localPort === localPort && p.id !== initialProfile?.id,
  );

  const localAddress = `http://127.0.0.1:${localPort}`;

  function copyAddress() {
    navigator.clipboard.writeText(localAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  useEffect(() => {
    const option = getProviderOption(providerId);
    if (!initialProfile) {
      setName((current) =>
        current === "" || current.endsWith("-dev") ? getDefaultName(providerId) : current,
      );
      setUpstreamBaseUrl((current) => {
        if (current === "" || PROVIDER_OPTIONS.some((p) => p.defaultUpstreamBaseUrl === current)) {
          return option.defaultUpstreamBaseUrl;
        }
        return current;
      });
    }
  }, [initialProfile, providerId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        id: initialProfile?.id ?? crypto.randomUUID(),
        name: name.trim(),
        providerId,
        upstreamBaseUrl: upstreamBaseUrl.trim(),
        localPort,
        enabled: initialProfile?.enabled ?? true,
        autoStart: initialProfile?.autoStart ?? true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5 text-left">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Connect provider</h2>
        <p className="text-sm text-muted-foreground">
          Create a local capture profile for one upstream model provider.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-name">Profile name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="anthropic-dev"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-provider">Provider</Label>
        <Select
          value={providerId}
          onValueChange={(value) => setProviderId(value as ProviderId)}
        >
          <SelectTrigger id="profile-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-upstream-base-url">Upstream base URL</Label>
        <Input
          id="profile-upstream-base-url"
          type="url"
          value={upstreamBaseUrl}
          onChange={(event) => setUpstreamBaseUrl(event.target.value)}
          placeholder={getProviderOption(providerId).defaultUpstreamBaseUrl}
        />
      </div>

      <div className="space-y-2">
        <Label>Local address</Label>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-md border bg-transparent shadow-xs">
            <span className="pl-3 text-sm text-muted-foreground select-none">http://127.0.0.1:</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={localPort}
              onChange={(event) => setLocalPort(Number(event.target.value) || DEFAULT_PROFILE_PORT_START)}
              className="h-9 w-20 bg-transparent text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={copyAddress}>
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {portConflict && (
          <p className="text-xs text-destructive mt-1">Port {localPort} is already used by another profile.</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={!name.trim() || !upstreamBaseUrl.trim() || portConflict || isSubmitting}
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
