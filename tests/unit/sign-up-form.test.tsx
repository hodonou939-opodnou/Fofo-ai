import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SignUpForm from "@/components/auth/sign-up-form";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const signUpMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { signUp: signUpMock },
  }),
}));

describe("SignUpForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    signUpMock.mockClear();
  });

  it("shows an already-registered error when Supabase returns the obfuscated duplicate-account response (no error, empty identities)", async () => {
    // Documented Supabase behavior when "Confirm email" is on: signing up with an
    // already-registered, already-confirmed email returns error: null and a user
    // with identities: [] (to prevent email enumeration), not a visible error.
    signUpMock.mockResolvedValue({
      data: { user: { id: "existing-user-id", identities: [] }, session: null },
      error: null,
    });

    render(<SignUpForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "already@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "correct horse battery staple 1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Un compte existe déjà avec cet e-mail."
      );
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects to /studio on a genuine new sign-up", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "new-user-id", identities: [{ id: "identity-1" }] }, session: {} },
      error: null,
    });

    render(<SignUpForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "new@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "correct horse battery staple 1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/studio");
    });
  });
});
