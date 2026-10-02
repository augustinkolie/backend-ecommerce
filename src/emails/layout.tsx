import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

/** Mise en page e-mail : même direction que la boutique (lin, encre, aucun dégradé). */
export const colors = {
  bg: "#F7F4EF",
  surface: "#FFFFFF",
  ink: "#1C1A17",
  muted: "#6B645B",
  line: "#E2DCD2",
  accent: "#B4532A",
};

export function EmailLayout({ preview, shopName, children }: { preview: string; shopName: string; children: ReactNode }) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.bg, color: colors.ink, fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Text style={{ fontFamily: "Georgia, serif", fontSize: 22, margin: "0 0 24px" }}>{shopName}</Text>
          <Section style={{ backgroundColor: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 4, padding: 24 }}>
            {children}
          </Section>
          <Hr style={{ borderColor: colors.line, margin: "24px 0 12px" }} />
          <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
            {shopName} — cet e-mail vous est envoyé suite à votre activité sur notre boutique.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function H({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: "Georgia, serif", fontSize: 22, lineHeight: 1.2, margin: "0 0 12px" }}>{children}</Text>;
}

export function P({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 12px", color: muted ? colors.muted : colors.ink }}>{children}</Text>;
}

export function CTA({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: colors.ink,
        color: "#FFFFFF",
        padding: "14px 24px",
        borderRadius: 2,
        textDecoration: "none",
        fontSize: 15,
        fontWeight: 600,
        margin: "8px 0 0",
      }}
    >
      {children}
    </a>
  );
}
