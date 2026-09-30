/**
 * Strip counsel/draft meta from legal draft text and emit sectioned TS/JSON.
 * Source: user-provided AltShift Quebec drafts (cleaned for publication UI).
 */
import fs from "fs";

function clean(text) {
  let s = text.replace(/\r\n/g, "\n").trim();

  // Drop draft banners / status
  s = s.replace(/^DRAFT FOR COUNSEL[\s\S]*?(?=\nBrand note:|\nImportant:|\nParties\n|\n1\. )/m, "");
  s = s.replace(/^BROUILLON POUR AVOCAT[\s\S]*?(?=\nNote de marque:|\nImportant :|\nParties\n|\n1\. )/m, "");
  s = s.replace(/^Status:.*\n?/gm, "");
  s = s.replace(/^Statut :.*\n?/gm, "");

  // Drop end markers
  s = s.replace(/\n— End of[\s\S]*$/m, "");
  s = s.replace(/\n— Fin du[\s\S]*$/m, "");

  // Bracketed counsel notes
  s = s.replace(/\s*\[COUNSEL[^\]]*\]/gi, "");
  s = s.replace(/\s*\[AVOCAT[^\]]*\]/gi, "");
  s = s.replace(/\s*\[CHOIX AVOCAT[^\]]*\]/gi, "");
  s = s.replace(/\s*\[PHONE optional\]/gi, "");
  s = s.replace(/\s*\[TÉLÉPHONE optionnel\]/gi, "");
  s = s.replace(/\[support email — confirm before publication\]/gi, "support@altshift.ca");
  s = s.replace(/\[courriel de soutien — confirmer avant publication\]/gi, "support@altshift.ca");

  // Research / why-changed blocks (EN)
  s = s.replace(/\nWhy this section changed:[\s\S]*?(?=\n6\.1 )/g, "\n");
  s = s.replace(/\nResearch note \(not legal advice\):[\s\S]*?(?=\n6\.1 )/g, "\n");
  // FR
  s = s.replace(/\nPourquoi cette section a changé :[\s\S]*?(?=\n6\.1 )/g, "\n");
  s = s.replace(/\nNote de recherche \(pas un avis juridique\) :[\s\S]*?(?=\n6\.1 )/g, "\n");

  // Insurance decision checklist line
  s = s.replace(/\n8\.2[\s\S]*?(?=\n9\. )/g, "\n8.2 You must upload a certificate of insurance when required for your trade category or when requested by Company.\n");
  s = s.replace(/\n8\.2[\s\S]*?(?=\n9\. )/g, "\n8.2 Vous devez téléverser un certificat d’assurance lorsque votre catégorie de métier l’exige ou lorsque la Société le demande.\n");

  // Fee conflict paragraphs → clean
  s = s.replace(
    /\n4\.3[\s\S]*?(?=\n4\.4 )/g,
    "\n4.3 Fees. Platform fees and any related charges are those shown at enrollment and at checkout. Pro invoices and Client checkout display the actual amounts payable.\n",
  );
  // If French fee conflict still present
  s = s.replace(
    /\n4\.3[\s\S]*?NE PAS PUBLIER UN SEUL POURCENTAGE[\s\S]*?(?=\n4\.4 )/g,
    "\n4.3 Frais. Les frais de plateforme et tout frais connexe sont ceux affichés à l’inscription et au paiement. Les factures Pro et le paiement Client affichent les montants réellement payables.\n",
  );

  // Collapse excess blank lines
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function toSections(docTitle, body) {
  const text = body.trim();
  const sections = [];
  // Split on lines that look like "N. Title" at start
  const parts = text.split(/\n(?=\d+\.\s)/);
  const preamble = parts[0].trim();
  if (preamble) {
    sections.push({ title: docTitle, body: preamble });
  }
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i].trim();
    const m = chunk.match(/^(\d+\.\s+[^\n]+)\n([\s\S]*)$/);
    if (m) {
      sections.push({ title: m[1].trim(), body: m[2].trim() });
    } else {
      const first = chunk.split("\n")[0];
      sections.push({ title: first, body: chunk.slice(first.length).trim() });
    }
  }
  return sections;
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function sectionsToTs(name, sections) {
  const items = sections
    .map(
      (sec) =>
        `  {\n    title: ${JSON.stringify(sec.title)},\n    body: \`${esc(sec.body)}\`,\n  }`,
    )
    .join(",\n");
  return `export const ${name} = [\n${items},\n];\n`;
}

// --- Paste cleaned operative sources (already lightly pre-trimmed in this script via clean()) ---

const consumerEn = fs.readFileSync("tmp-legal/consumer-en.md", "utf8");
const consumerFr = fs.readFileSync("tmp-legal/consumer-fr.md", "utf8");
const proEn = fs.readFileSync("tmp-legal/pro-en.md", "utf8");
const proFr = fs.readFileSync("tmp-legal/pro-fr.md", "utf8");
const privacyEn = fs.readFileSync("tmp-legal/privacy-en.md", "utf8");
const privacyFr = fs.readFileSync("tmp-legal/privacy-fr.md", "utf8");

const cEn = clean(consumerEn);
const cFr = clean(consumerFr);
const pEn = clean(proEn);
const pFr = clean(proFr);
const privEn = clean(privacyEn);
const privFr = clean(privacyFr);

fs.writeFileSync(
  "tmp-legal/cleaned-preview.json",
  JSON.stringify(
    {
      consumerEn: toSections("Consumer Terms of Service", cEn),
      consumerFr: toSections("Conditions d'utilisation", cFr),
      proEn: toSections("Professional Service Provider Agreement", pEn),
      proFr: toSections("Contrat de prestataire de services professionnels", pFr),
      privacyEn: toSections("Privacy Policy", privEn),
      privacyFr: toSections("Politique de confidentialité", privFr),
    },
    null,
    2,
  ),
);

console.log("cleaned", {
  cEn: cEn.length,
  cFr: cFr.length,
  pEn: pEn.length,
  pFr: pFr.length,
  privEn: privEn.length,
  privFr: privFr.length,
});
