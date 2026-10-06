import type { Metadata } from "next";
import LegalPage from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Conditions générales" };

export default function TermsPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation">
      <p>
        En utilisant Fofo AI, tu acceptes que les musiques générées soient des créations originales produites par un
        système d&apos;intelligence artificielle, inspirées de rythmes traditionnels béninois, et non des
        enregistrements de musiciens existants.
      </p>
    </LegalPage>
  );
}
