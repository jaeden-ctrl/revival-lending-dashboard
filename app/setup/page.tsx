export default function SetupPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "#141414",
          border: "1px solid #1F1F1F",
          borderRadius: 16,
          padding: 40,
          maxWidth: 480,
          width: "100%",
        }}
      >
        <h1 style={{ color: "#C9A84C", fontSize: 20, marginBottom: 8, fontWeight: 700 }}>
          RingCentral Setup
        </h1>
        <p style={{ color: "#6B6B6B", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          Click below to authorize your RingCentral account. You'll be redirected to RingCentral
          to log in, then brought back here with your refresh token.
        </p>
        <a
          href="/api/ringcentral/auth"
          style={{
            display: "block",
            background: "#C9A84C",
            color: "#0A0A0A",
            padding: "12px 24px",
            borderRadius: 8,
            textAlign: "center",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Connect RingCentral
        </a>
      </div>
    </div>
  );
}
