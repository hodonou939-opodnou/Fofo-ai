import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInForm from "@/components/auth/sign-in-form";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";
import NewPasswordForm from "@/components/auth/new-password-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { signInWithPassword, resetPasswordForEmail, updateUser } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("SignInForm", () => {
  it("returns the member to where they were going", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<SignInForm next="/bibliotheque?rythme=zinli" />);
    fill("E-mail", "awa@example.test");
    fill("Mot de passe", "correct horse battery staple 1!");
    fireEvent.click(screen.getByRole("button", { name: "Me connecter" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bibliotheque?rythme=zinli"));
    expect(refresh).toHaveBeenCalled();
  });

  it("never follows an outside address after sign-in", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<SignInForm next="//evil.example" />);
    fill("E-mail", "awa@example.test");
    fill("Mot de passe", "correct horse battery staple 1!");
    fireEvent.click(screen.getByRole("button", { name: "Me connecter" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/studio"));
  });

  it("explains wrong credentials without saying which one is wrong", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<SignInForm />);
    fill("E-mail", "awa@example.test");
    fill("Mot de passe", "nope nope nope");
    fireEvent.click(screen.getByRole("button", { name: "Me connecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou mot de passe incorrect.");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("ForgotPasswordForm", () => {
  it("asks Supabase for a link that comes back to the new-password page", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordForm />);
    fill("E-mail", "awa@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    await waitFor(() =>
      expect(resetPasswordForEmail).toHaveBeenCalledWith("awa@example.test", {
        redirectTo: `${window.location.origin}/auth/confirm?next=/nouveau-mot-de-passe`,
      })
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/un lien vient d'être envoyé/i);
  });

  it("shows the problem instead of pretending the e-mail was sent", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: "Email address not authorized", status: 400 } });
    render(<ForgotPasswordForm />);
    fill("E-mail", "awa@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible d'envoyer l'e-mail pour le moment.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("explains when too many links were requested", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: "email rate limit exceeded", status: 429 } });
    render(<ForgotPasswordForm />);
    fill("E-mail", "awa@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop de demandes. Réessaie dans quelques minutes.");
  });
});

describe("NewPasswordForm", () => {
  it("refuses a password shorter than 8 characters", async () => {
    render(<NewPasswordForm />);
    fill("Nouveau mot de passe", "court");
    fill("Confirme le mot de passe", "court");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("8 caractères minimum.");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses two different passwords", async () => {
    render(<NewPasswordForm />);
    fill("Nouveau mot de passe", "correct horse battery");
    fill("Confirme le mot de passe", "correct horse battery staple");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Les deux mots de passe ne correspondent pas.");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("saves the new password and opens the Studio", async () => {
    updateUser.mockResolvedValue({ error: null });
    render(<NewPasswordForm />);
    fill("Nouveau mot de passe", "correct horse battery staple");
    fill("Confirme le mot de passe", "correct horse battery staple");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "correct horse battery staple" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/studio"));
  });

  it("asks for a different password when Supabase refuses the old one", async () => {
    updateUser.mockResolvedValue({ error: { message: "New password should be different from the old password.", code: "same_password" } });
    render(<NewPasswordForm />);
    fill("Nouveau mot de passe", "correct horse battery staple");
    fill("Confirme le mot de passe", "correct horse battery staple");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choisis un mot de passe différent de l'ancien.");
  });
});
