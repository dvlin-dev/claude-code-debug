import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "../stores/app-store";

export function UpdateToastListener() {
  const { updateState, quitAndInstallUpdate } = useAppStore();
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const signature = [
      updateState.status,
      updateState.availableVersion,
      updateState.message,
      updateState.downloadPercent,
    ].join(":");

    if (signature === lastSignatureRef.current) {
      return;
    }
    lastSignatureRef.current = signature;

    // With autoDownload enabled, "available" transitions to "downloading"
    // automatically, so we only need to notify when download completes.
    if (updateState.status === "downloaded" && updateState.availableVersion) {
      toast.success(
        `Version ${updateState.availableVersion} is ready to install.`,
        {
          duration: Infinity,
          action: {
            label: "Restart",
            onClick: () => void quitAndInstallUpdate(),
          },
        },
      );
      return;
    }

    if (updateState.status === "error" && updateState.message) {
      toast.error(updateState.message);
    }
  }, [quitAndInstallUpdate, updateState]);

  return null;
}
