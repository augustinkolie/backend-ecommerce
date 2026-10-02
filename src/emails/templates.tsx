import { Column, Row } from "@react-email/components";
import { colors, CTA, EmailLayout, H, P } from "./layout";

type Line = { name: string; attributes: string; quantity: number; total: string };

function Lines({ lines }: { lines: Line[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <Row key={i} style={{ borderBottom: `1px solid ${colors.line}`, padding: "8px 0" }}>
          <Column>
            <P>
              {l.name} × {l.quantity}
              <br />
              <span style={{ color: colors.muted, fontSize: 13 }}>{l.attributes}</span>
            </P>
          </Column>
          <Column align="right">
            <P>{l.total}</P>
          </Column>
        </Row>
      ))}
    </>
  );
}

export function OrderConfirmation(p: { shopName: string; number: number; lines: Line[]; total: string; url: string; paymentLabel: string }) {
  return (
    <EmailLayout shopName={p.shopName} preview={`Commande n° ${p.number} confirmée`}>
      <H>Merci pour votre commande</H>
      <P>Votre commande n° {p.number} est confirmée. Paiement : {p.paymentLabel}.</P>
      <Lines lines={p.lines} />
      <P>
        <strong>Total : {p.total}</strong>
      </P>
      <CTA href={p.url}>Suivre ma commande</CTA>
    </EmailLayout>
  );
}

export function OrderShipped(p: { shopName: string; number: number; carrier: string; tracking?: string | null; url: string }) {
  return (
    <EmailLayout shopName={p.shopName} preview={`Commande n° ${p.number} expédiée`}>
      <H>Votre commande est en route</H>
      <P>
        La commande n° {p.number} a été confiée à {p.carrier}.
        {p.tracking ? ` Numéro de suivi : ${p.tracking}.` : ""}
      </P>
      <CTA href={p.url}>Suivre ma commande</CTA>
    </EmailLayout>
  );
}

export function OrderDelivered(p: { shopName: string; number: number; url: string }) {
  return (
    <EmailLayout shopName={p.shopName} preview={`Commande n° ${p.number} livrée`}>
      <H>Votre commande est arrivée</H>
      <P>La commande n° {p.number} a été livrée. Nous espérons qu&apos;elle vous plaît.</P>
      <CTA href={p.url}>Voir ma commande</CTA>
    </EmailLayout>
  );
}

export function AbandonedCart(p: { shopName: string; lines: Line[]; url: string }) {
  return (
    <EmailLayout shopName={p.shopName} preview="Votre panier vous attend">
      <H>Votre panier vous attend</H>
      <P muted>Vos articles sont encore disponibles, mais les tailles partent vite.</P>
      <Lines lines={p.lines} />
      <CTA href={p.url}>Reprendre mon panier</CTA>
    </EmailLayout>
  );
}

export function ReviewRequest(p: { shopName: string; number: number; products: { name: string; url: string }[] }) {
  return (
    <EmailLayout shopName={p.shopName} preview="Votre avis compte">
      <H>Qu&apos;en pensez-vous ?</H>
      <P>Vous avez reçu votre commande n° {p.number}. Votre avis aide les autres clients à choisir.</P>
      {p.products.map((prod) => (
        <P key={prod.url}>
          <a href={prod.url} style={{ color: colors.ink }}>
            Donner mon avis sur {prod.name}
          </a>
        </P>
      ))}
    </EmailLayout>
  );
}

export function BackInStock(p: { shopName: string; name: string; variant: string; url: string }) {
  return (
    <EmailLayout shopName={p.shopName} preview={`${p.name} est de retour`}>
      <H>De retour en stock</H>
      <P>
        {p.name} ({p.variant}) est de nouveau disponible.
      </P>
      <CTA href={p.url}>Voir le produit</CTA>
    </EmailLayout>
  );
}

export function MagicLink(p: { shopName: string; url: string }) {
  return (
    <EmailLayout shopName={p.shopName} preview="Votre lien de connexion">
      <H>Connexion</H>
      <P>Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est valable 15 minutes.</P>
      <CTA href={p.url}>Me connecter</CTA>
      <P muted>Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez cet e-mail.</P>
    </EmailLayout>
  );
}
