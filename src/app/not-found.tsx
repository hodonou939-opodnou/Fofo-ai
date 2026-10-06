import Button from "@/components/ui/button";
import Cover from "@/components/brand/cover";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <Cover slug={null} seed="introuvable" className="size-40 rounded-panel" />
      <h1 className="mt-10 font-display text-5xl text-ivory md:text-6xl">Cette page n&apos;existe pas</h1>
      <p className="mt-4 text-dust">
        Le lien est peut-être incomplet, ou le morceau partagé n&apos;est plus disponible.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button href="/">Retour à l&apos;accueil</Button>
        <Button href="/rythmes" variant="ghost">
          Découvrir les rythmes
        </Button>
      </div>
    </main>
  );
}
