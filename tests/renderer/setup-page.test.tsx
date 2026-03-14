import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileForm } from "../../src/renderer/src/features/profiles/profile-form";

describe("ProfileForm", () => {
  let onSubmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSubmit = vi.fn().mockResolvedValue(undefined);
  });

  it("renders provider setup fields", () => {
    render(<ProfileForm onSubmit={onSubmit} />);

    expect(screen.getByText(/connect provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upstream base url/i)).toBeInTheDocument();
    expect(screen.getByText(/local address/i)).toBeInTheDocument();
  });

  it("submits a normalized connection profile", async () => {
    render(<ProfileForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/profile name/i), {
      target: { value: "anthropic-dev" },
    });
    // Port input is now inside the composite "Local address" field
    const portInput = screen.getByRole("spinbutton");
    fireEvent.change(portInput, { target: { value: "8899" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "anthropic-dev",
          providerId: "anthropic",
          upstreamBaseUrl: "https://api.anthropic.com",
          localPort: 8899,
          enabled: true,
          autoStart: true,
        }),
      );
    });
  });
});
