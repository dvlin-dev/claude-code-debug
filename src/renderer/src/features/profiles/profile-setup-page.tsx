import { useState } from "react";
import { Check, ChevronRight, Copy } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useProfileStore } from "../../stores/profile-store";
import type { ProviderId } from "../../../../shared/contracts";
import { DEFAULT_PROFILE_PORT_START } from "../../../../shared/defaults";
import { ProfileForm } from "./profile-form";
import { cn } from "../../lib/utils";

const PROVIDERS = [
  {
    id: "anthropic" as ProviderId,
    label: "Claude Code",
    emoji: "🟠",
    protocol: "Anthropic Messages API",
    defaultPort: DEFAULT_PROFILE_PORT_START,
    defaultUrl: "https://api.anthropic.com",
    envVar: "ANTHROPIC_BASE_URL",
    clientName: "Claude Code",
  },
  {
    id: "codex" as ProviderId,
    label: "Codex",
    emoji: "🟢",
    protocol: "OpenAI Responses API",
    defaultPort: DEFAULT_PROFILE_PORT_START + 1,
    defaultUrl: "https://chatgpt.com/backend-api/codex",
    envVar: "OPENAI_BASE_URL",
    clientName: "Codex CLI",
  },
];

type Step = "select" | "configure" | "manual";

export function ProfileSetupPage() {
  const [step, setStep] = useState<Step>("select");
  const [selectedId, setSelectedId] = useState<ProviderId>("anthropic");
  const [upstreamUrl, setUpstreamUrl] = useState(PROVIDERS[0].defaultUrl);
  const [localPort, setLocalPort] = useState(PROVIDERS[0].defaultPort);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const upsertProfile = useProfileStore((s) => s.upsertProfile);
  const startProfile = useProfileStore((s) => s.startProfile);
  const profiles = useProfileStore((s) => s.profiles);
  const statuses = useProfileStore((s) => s.statuses);

  const provider = PROVIDERS.find((p) => p.id === selectedId) ?? PROVIDERS[0];
  const localAddress = `http://127.0.0.1:${localPort}`;
  const exportCmd = `export ${provider.envVar}=${localAddress}`;

  function handleSelectProvider(id: ProviderId) {
    setSelectedId(id);
    const p = PROVIDERS.find((pv) => pv.id === id) ?? PROVIDERS[0];
    setUpstreamUrl(p.defaultUrl);
    setLocalPort(p.defaultPort);
  }

  function handleNext() {
    setStep("configure");
  }

  async function handleStart() {
    setIsCreating(true);
    try {
      const profile = {
        id: crypto.randomUUID(),
        name: `${provider.label} Dev`,
        providerId: provider.id,
        upstreamBaseUrl: upstreamUrl.trim() || provider.defaultUrl,
        localPort,
        enabled: true,
        autoStart: true,
      };
      await upsertProfile(profile);
      await startProfile(profile.id);
    } finally {
      setIsCreating(false);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  // ---------- Manual form ----------
  if (step === "manual") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="w-full max-w-md">
          <button
            className="text-xs text-muted-foreground hover:text-foreground mb-4"
            onClick={() => setStep("configure")}
          >
            ← Back
          </button>
          <ProfileForm
            onSubmit={async (profile) => {
              await upsertProfile(profile);
              await startProfile(profile.id);
            }}
          />
        </div>
      </div>
    );
  }

  // ---------- Step 2: Configure ----------
  if (step === "configure") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="w-full max-w-lg">
          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mb-6">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
            <div className="h-1.5 w-4 rounded-full bg-violet-500" />
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="text-center mb-6">
            <div className="text-base font-semibold mb-1">
              {provider.emoji} {provider.label}
            </div>
            <div className="text-xs text-muted-foreground">
              Configure your connection
            </div>
          </div>

          {/* Flow diagram */}
          <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground">
            <span className="px-2 py-1 border border-border bg-muted/50 font-mono text-[10px]">
              {provider.clientName}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span className="px-2 py-1 border border-violet-500/30 bg-violet-500/5 font-mono text-[10px] text-violet-400">
              Agent Trace
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span className="px-2 py-1 border border-border bg-muted/50 font-mono text-[10px]">
              Upstream API
            </span>
          </div>

          {/* Section 1: Upstream URL */}
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold">
                1
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your upstream API URL
              </span>
            </div>
            <Input
              value={upstreamUrl}
              onChange={(e) => setUpstreamUrl(e.target.value)}
              placeholder={provider.defaultUrl}
              className="font-mono text-xs h-9"
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Requests will be forwarded here. Change this if you use a custom
              endpoint or proxy.
            </p>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground mb-5">
            <span>Agent Trace will listen on</span>
            <span className="text-violet-400">↓</span>
          </div>

          {/* Section 2: Local address */}
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold">
                2
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your local listener address
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                value={localAddress}
                readOnly
                className="font-mono text-xs h-9 text-muted-foreground flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => copyToClipboard(localAddress, "address")}
              >
                {copied === "address" ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copy
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Point your agent client to this address instead of the upstream
              URL.
            </p>
          </div>

          {/* Shell block */}
          <div className="relative border border-border bg-black/30 p-3 mb-6">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Configure your client
            </div>
            <code className="text-xs text-emerald-400 font-mono">
              {exportCmd}
            </code>
            <button
              className="absolute top-2.5 right-2.5 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5"
              onClick={() => copyToClipboard(exportCmd, "export")}
            >
              {copied === "export" ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Port input (collapsed) */}
          <details className="mb-6 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Advanced: change local port
            </summary>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted-foreground">Port:</span>
              <Input
                type="number"
                min={1}
                max={65535}
                value={localPort}
                onChange={(e) => setLocalPort(Number(e.target.value) || provider.defaultPort)}
                className="w-24 font-mono text-xs h-8"
              />
            </div>
          </details>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep("select")}
            >
              ← Back
            </Button>
            <Button onClick={handleStart} disabled={isCreating}>
              {isCreating ? "Starting…" : "Start Listening"}
            </Button>
          </div>

          <div className="text-center mt-3">
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              onClick={() => setStep("manual")}
            >
              Advanced: manual configuration
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Step 1: Select provider ----------
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="text-center max-w-lg">
        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          <div className="h-1.5 w-4 rounded-full bg-violet-500" />
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="mx-auto w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-2xl mb-5 shadow-lg shadow-violet-500/20">
          🔍
        </div>

        <h1 className="text-xl font-bold tracking-tight mb-1">
          Welcome to Agent Trace
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Select the agent you want to trace
        </p>

        {/* Provider Cards */}
        <div className="flex gap-3 justify-center mb-8">
          {PROVIDERS.map((card) => (
            <button
              key={card.id}
              onClick={() => handleSelectProvider(card.id)}
              className={cn(
                "w-44 p-4 border text-left transition-all",
                selectedId === card.id
                  ? "border-violet-500 bg-violet-500/5 shadow-sm shadow-violet-500/10"
                  : "border-border hover:border-muted-foreground/30",
              )}
            >
              <div className="text-xl mb-2">{card.emoji}</div>
              <div className="text-sm font-semibold">{card.label}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {card.protocol}
              </div>
            </button>
          ))}
        </div>

        <Button onClick={handleNext}>
          Next →
        </Button>

        {/* Existing profiles */}
        {profiles.length > 0 && (
          <div className="mt-10 text-left max-w-sm mx-auto">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Existing Profiles
            </div>
            {profiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 text-xs py-1.5"
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    statuses[p.id]?.isRunning
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/30",
                  )}
                />
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground ml-auto font-mono">
                  :{p.localPort}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
