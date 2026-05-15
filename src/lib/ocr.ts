// Parse business-card OCR text into structured fields.
const CITIES = [
  "Dubai","Abu Dhabi","Sharjah","Ajman","Riyadh","Jeddah","Dammam","Khobar","Doha",
  "Manama","Kuwait","Muscat","Bangalore","Bengaluru","Mumbai","Delhi","Chennai",
  "Hyderabad","Pune","Gurgaon","Noida","London","Manchester","Birmingham"
];
const TITLE_HINTS = [
  "manager","director","head","chief","officer","engineer","supervisor","specialist",
  "lead","architect","analyst","consultant","executive","president","founder","ceo",
  "cto","cio","coo","cfo","vp","vice president","md","general manager"
];

export type ParsedCard = {
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  contact_phone?: string;
  company_name?: string;
  location?: string;
};

export function parseCard(raw: string): ParsedCard {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedCard = {};

  const emailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  const phoneRe = /(\+?\d[\d\s\-().]{7,}\d)/;

  let titleIdx = -1, emailIdx = -1, locIdx = -1;
  lines.forEach((line, i) => {
    if (!out.contact_email) {
      const m = line.match(emailRe);
      if (m) { out.contact_email = m[0]; emailIdx = i; }
    }
    if (!out.contact_phone) {
      const m = line.match(phoneRe);
      if (m && m[0].replace(/\D/g, "").length >= 8) out.contact_phone = m[0].trim();
    }
    if (!out.contact_title) {
      const lower = line.toLowerCase();
      if (TITLE_HINTS.some((h) => lower.includes(h)) && line.length < 60) {
        out.contact_title = line;
        titleIdx = i;
      }
    }
    if (!out.location) {
      const hit = CITIES.find((c) => line.toLowerCase().includes(c.toLowerCase()));
      if (hit) { out.location = hit; locIdx = i; }
    }
  });

  // Name = line above title, or first short non-special line
  if (titleIdx > 0) {
    const cand = lines[titleIdx - 1];
    if (cand && !emailRe.test(cand) && !phoneRe.test(cand) && cand.length < 50) {
      out.contact_name = cand;
    }
  }
  if (!out.contact_name) {
    const cand = lines.find((l, i) => i !== titleIdx && i !== emailIdx && /^[A-Za-z][A-Za-z .'-]+$/.test(l) && l.split(" ").length >= 2 && l.length < 50);
    if (cand) out.contact_name = cand;
  }

  // Company = email domain or longest non-classified line
  if (out.contact_email) {
    const domain = out.contact_email.split("@")[1]?.split(".")[0];
    if (domain && domain.length > 2) {
      out.company_name = domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }
  if (!out.company_name) {
    const cand = lines.find((l, i) =>
      i !== titleIdx && i !== emailIdx && i !== locIdx &&
      l !== out.contact_name && !emailRe.test(l) && !phoneRe.test(l) &&
      l.length > 3 && l.length < 60
    );
    if (cand) out.company_name = cand;
  }

  return out;
}
