import { toast } from "sonner";
import { SetupForm } from "../components/setup-form";
import { useAppStore } from "../stores/app-store";

export function SetupPage() {
  const saveSettings = useAppStore((s) => s.saveSettings);

  const handleSubmit = async (targetUrl: string) => {
    await saveSettings({ targetUrl });
    toast.success("Settings saved");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Agent Trace
          </h1>
          <p className="text-muted-foreground">
            Intercept and analyze Claude Code API conversations
          </p>
        </div>
        <SetupForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
