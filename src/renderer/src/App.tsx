import { useEffect } from "react";
import { useAppStore } from "./stores/app-store";
import { useProfileStore } from "./stores/profile-store";
import { WorkspacePage } from "./pages/workspace-page";
import { UpdateToastListener } from "./components/update-toast-listener";
import { ProfileSetupPage } from "./features/profiles/profile-setup-page";
import { ErrorBoundary } from "./components/error-boundary";

function LoadingSkeleton() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

export default function App() {
  const { initialized, initialize } = useAppStore();
  const profiles = useProfileStore((state) => state.profiles);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!initialized) return <LoadingSkeleton />;
  if (profiles.length === 0) {
    return (
      <ErrorBoundary>
        <UpdateToastListener />
        <ProfileSetupPage />
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary>
      <UpdateToastListener />
      <WorkspacePage />
    </ErrorBoundary>
  );
}
