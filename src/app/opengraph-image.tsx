import { ImageResponse } from "next/og";

export const alt = "Horizon - a modern banking platform";
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
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(90deg, #0179FE 0%, #4893FF 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0179FE",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            H
          </div>
          <div style={{ fontSize: 64, fontWeight: 700 }}>Horizon</div>
        </div>
        <div style={{ fontSize: 36, marginTop: 40, opacity: 0.95 }}>
          All your bank accounts, balances and transactions in one place.
        </div>
      </div>
    ),
    size
  );
}
