import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import Dialog from "@/components/ui/dialog";
import Chip from "@/components/ui/chip";

describe("Button", () => {
  it("renders a real button that reports clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Générer</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not report clicks while disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Générer
      </Button>
    );
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a link when given an href", () => {
    render(<Button href="/studio">Créer ma musique</Button>);
    expect(screen.getByRole("link", { name: "Créer ma musique" })).toHaveAttribute("href", "/studio");
  });

  it("marks itself busy and stays unclickable while loading", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading>
        Générer
      </Button>
    );
    const button = screen.getByRole("button", { name: /Générer/ });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Field", () => {
  it("labels its control and announces an error", () => {
    render(
      <Field label="E-mail" error="Cette adresse n'est pas valide.">
        {(props) => <input type="email" {...props} />}
      </Field>
    );
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Cette adresse n'est pas valide.");
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
  });

  it("shows a hint without marking the control invalid", () => {
    render(
      <Field label="Mot de passe" hint="8 caractères minimum.">
        {(props) => <input type="password" {...props} />}
      </Field>
    );
    expect(screen.getByLabelText("Mot de passe")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("8 caractères minimum.")).toBeInTheDocument();
  });
});

describe("Chip", () => {
  it("exposes its selected state to assistive technology", () => {
    render(
      <Chip selected onClick={() => {}}>
        Zinli
      </Chip>
    );
    expect(screen.getByRole("button", { name: "Zinli" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Dialog", () => {
  it("is a labelled modal dialog that closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Partager" onClose={onClose}>
        <p>Lien</p>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog", { name: "Partager" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} title="Partager" onClose={() => {}}>
        <p>Lien</p>
      </Dialog>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Dialog — keyboard", () => {
  function renderDialog(onClose = vi.fn()) {
    render(
      <>
        <button>Derrière</button>
        <Dialog open title="Renommer" onClose={onClose}>
          <input aria-label="Titre" />
          <button>Enregistrer</button>
        </Dialog>
      </>
    );
    return onClose;
  }

  it("keeps Tab inside the dialog, cycling from the last control back to the first", () => {
    renderDialog();
    const save = screen.getByRole("button", { name: "Enregistrer" });
    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveFocus();
  });

  it("cycles Shift+Tab from the first control to the last", () => {
    renderDialog();
    const close = screen.getByRole("button", { name: "Fermer" });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Enregistrer" })).toHaveFocus();
  });

  it("closes on Escape even when focus is outside the panel", () => {
    const onClose = renderDialog();
    screen.getByRole("button", { name: "Derrière" }).focus();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
