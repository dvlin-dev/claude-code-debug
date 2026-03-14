import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ConnectionProfile } from "../../src/shared/contracts";
import { ProfileSetupPage } from "../../src/renderer/src/features/profiles/profile-setup-page";
import { useProfileStore } from "../../src/renderer/src/stores/profile-store";

let storedProfiles: ConnectionProfile[] = [];

const mockGetProfiles = vi.fn(async () => storedProfiles);
const mockSaveProfiles = vi.fn(async (profiles: ConnectionProfile[]) => {
  storedProfiles = profiles;
  return profiles;
});
const mockGetProfileStatuses = vi.fn(async () => ({
  "anthropic-dev": { isRunning: true, port: 8888 },
}));

vi.mock("../../src/renderer/src/lib/electron-api", () => ({
  getElectronAPI: () => ({
    getProfiles: mockGetProfiles,
    saveProfiles: mockSaveProfiles,
    getProfileStatuses: mockGetProfileStatuses,
    startProfile: vi.fn(async () => {}),
    stopProfile: vi.fn(async () => {}),
  }),
}));

describe("ProfileSetupPage", () => {
  beforeEach(() => {
    storedProfiles = [
      {
        id: "anthropic-dev",
        name: "anthropic-dev",
        providerId: "anthropic",
        upstreamBaseUrl: "https://api.anthropic.com",
        localPort: 8888,
        enabled: true,
        autoStart: false,
      },
    ];

    mockGetProfiles.mockClear();
    mockSaveProfiles.mockClear();
    mockGetProfileStatuses.mockClear();

    useProfileStore.setState({
      profiles: storedProfiles,
      statuses: { "anthropic-dev": { isRunning: true, port: 8888 } },
      initialized: true,
    });
  });

  it("shows provider cards and existing profiles on Step 1", async () => {
    render(<ProfileSetupPage />);

    expect(screen.getByText("Welcome to Agent Trace")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();

    expect(await screen.findByText("anthropic-dev")).toBeInTheDocument();
  });

  it("shows upstream URL and local address on Step 2", () => {
    render(<ProfileSetupPage />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(
      screen.getByDisplayValue("https://api.anthropic.com"),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("http://127.0.0.1:8888"),
    ).toBeInTheDocument();
    expect(screen.getByText(/ANTHROPIC_BASE_URL/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start listening/i }),
    ).toBeInTheDocument();
  });

  it("navigates to manual form from Step 2", async () => {
    render(<ProfileSetupPage />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByText(/manual configuration/i));

    expect(screen.getByLabelText(/profile name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upstream base url/i)).toBeInTheDocument();
  });

  it("creates a profile via quick-start on Step 2", async () => {
    render(<ProfileSetupPage />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /start listening/i }));

    await waitFor(() => {
      expect(mockSaveProfiles).toHaveBeenCalledTimes(1);
    });
  });
});
