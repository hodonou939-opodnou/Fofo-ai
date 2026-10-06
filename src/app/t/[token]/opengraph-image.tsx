import { ImageResponse } from "next/og";
import { getSharedTrack } from "@/lib/tracks/shared";

// The preview card WhatsApp and other apps show for a share link.
export const alt = "Une création Fofo AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same rhythm colours as the cover art (ImageResponse can't read CSS tokens).
const BASES: Record<string, string> = { tchinkounme: "#5c1b12", zinli: "#0d4343", toba: "#33194f" };

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const track = await getSharedTrack(token);
  const title = track?.title ?? "Fofo AI";
  const rhythm = track?.rhythmName ?? "Les rythmes du Bénin";
  const base = (track?.rhythmSlug && BASES[track.rhythmSlug]) || "#221c16";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0f0c09", color: "#f3ebdd" }}>
        <div
          style={{
            display: "flex",
            width: 630,
            height: 630,
            alignItems: "center",
            justifyContent: "center",
            background: `radial-gradient(circle at 50% 50%, #e4c77a 0%, ${base} 45%, ${base} 100%)`,
          }}
        >
          {[90, 170, 250, 330].map((r) => (
            <div
              key={r}
              style={{
                position: "absolute",
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                border: "3px solid rgba(228, 199, 122, 0.55)",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 56, flex: 1 }}>
          <div style={{ fontSize: 28, color: "#a69a88" }}>Une création Fofo AI</div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, marginTop: 18 }}>{title}</div>
          <div style={{ fontSize: 34, color: "#e4c77a", marginTop: 24 }}>{rhythm}</div>
        </div>
      </div>
    ),
    size
  );
}
