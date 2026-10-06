import type { Metadata } from "next";
import LegalPage from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Confidentialité">
      <p>
        Fofo AI collecte ton adresse e-mail pour créer ton compte, ainsi que les musiques que tu génères et leurs
        paramètres, pour te permettre d&apos;y accéder dans ta bibliothèque personnelle. Ces données ne sont pas
        partagées avec des tiers en dehors des prestataires techniques strictement nécessaires au fonctionnement du
        service (hébergement, base de données, génération audio).
      </p>
      <p>
        Tes créations sont privées. Si tu en partages une, toute personne qui a le lien peut l&apos;écouter et la
        télécharger, jusqu&apos;à ce que tu arrêtes le partage ou que tu supprimes la création.
      </p>
    </LegalPage>
  );
}
