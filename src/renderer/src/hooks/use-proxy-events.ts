import { useEffect } from "react";
import { toast } from "sonner";
import { getElectronAPI } from "../lib/electron-api";
import { useSessionStore } from "../stores/session-store";
import { useRequestStore } from "../stores/request-store";

export function useProxyEvents() {
  const updateSessions = useSessionStore((s) => s.updateSessions);
  const refreshSessionIfSelected = useRequestStore(
    (s) => s.refreshSessionIfSelected,
  );

  useEffect(() => {
    const api = getElectronAPI();

    const unsubCapture = api.onCaptureUpdated((payload) => {
      updateSessions(payload.sessions);
      const selectedSessionId = useSessionStore.getState().selectedSessionId;
      void refreshSessionIfSelected(
        payload.updatedSessionId,
        selectedSessionId,
      );
    });

    const unsubError = api.onProxyError((error) => {
      toast.error("Proxy Error", { description: error });
    });

    return () => {
      unsubCapture();
      unsubError();
    };
  }, [refreshSessionIfSelected, updateSessions]);
}
