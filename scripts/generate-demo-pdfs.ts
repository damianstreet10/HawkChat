/**
 * Creates two demo PDFs in seed/useful-resources/ for LAN preload.
 * Run: npm run generate:pdfs
 */
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUT_DIR = path.join(process.cwd(), "seed", "useful-resources");

const DOCS: { filename: string; title: string; body: string }[] = [
  {
    filename: "01-hawkeye-overview.pdf",
    title: "Hawk-Eye Innovations — Overview",
    body: `Hawk-Eye is a sports technology company known for precision ball tracking, video replay, and officiating support. The system is used in tennis, football, cricket, rugby, baseball, basketball, ice hockey, and American football.

Core capabilities include video replay (multi-angle capture for review and broadcast), optical tracking (ball and player movement), and insight tools (data visualization for performance and fans).

Officiating examples: football VAR and goal-line technology; tennis electronic line calling; cricket ball tracking and UltraEdge; baseball replay and StatCast tracking.

Systems are built for fairness, safety, engagement, and informed decision-making across professional sport worldwide.`,
  },
  {
    filename: "02-demo-faq.pdf",
    title: "HawkChat LAN Demo — FAQ",
    body: `This notebook is pre-loaded for demonstrations on a private network such as 10.0.2.x. Guests ask questions and receive answers grounded only in the built-in documents.

You can ask: summarize main themes; which sports use tracking; how video replay differs from tracking; what officiating tools are described.

Answers use indexed passages only, with citations. The assistant should not invent facts beyond the sources. Internet is required for the language model during chat.

Hosts can replace these PDFs in seed/useful-resources/ and restart with HAWKCHAT_AUTO_SEED=true. Share your server IP on port 3000.`,
  },
];

async function writePdf(
  filename: string,
  title: string,
  body: string,
): Promise<void> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  const margin = 50;
  let y = 750;

  page.drawText(title, {
    x: margin,
    y,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 36;

  const words = body.split(/\s+/);
  let line = "";
  const maxWidth = 512;
  const size = 11;
  const lineHeight = 14;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x: margin, y, size, font, color: rgb(0.2, 0.2, 0.2) });
      y -= lineHeight;
      line = word;
      if (y < margin) break;
    } else {
      line = test;
    }
  }
  if (line && y >= margin) {
    page.drawText(line, { x: margin, y, size, font, color: rgb(0.2, 0.2, 0.2) });
  }

  const bytes = await pdf.save();
  fs.writeFileSync(path.join(OUT_DIR, filename), bytes);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const doc of DOCS) {
    await writePdf(doc.filename, doc.title, doc.body);
    console.log(`Wrote ${doc.filename}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
