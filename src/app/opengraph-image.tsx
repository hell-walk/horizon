import { ImageResponse } from "next/og";

export const alt = "Horizon - every account, one ledger";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social preview card, generated at build time.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#FAF9F5",
          color: "#1A1C1A",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              background: "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 28, height: 28, background: "#C7EF00", transform: "rotate(45deg)" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>HORIZON // 01</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1, letterSpacing: -3 }}>Every account.</div>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1, letterSpacing: -3 }}>One ledger.</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: "#46464B" }}>
          <div>Plaid · Setu AA · Statement import</div>
          <div style={{ background: "#C7EF00", color: "#171E00", padding: "8px 16px", fontWeight: 700 }}>USD · INR</div>
        </div>
      </div>
    ),
    size
  );
}
