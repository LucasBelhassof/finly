import { PasswordException, PDFParse } from "pdf-parse";

import {
  createPdfParseOptions,
  createPdfPasswordError,
  detectPdfIssuer,
  parseCreditCardPdfStatement,
} from "../../transaction-import.js";
import { ImportHttpError } from "../errors.js";
import { parseTextLines } from "./text-parser.js";

const PDF_PAGE_JOINER = "\n-- page_number of total_number --\n";

function buildNoSelectableTextError() {
  return new ImportHttpError(
    "import_pdf_no_selectable_text",
    "PDF has no selectable text. Export a text-based PDF, CSV, OFX, or spreadsheet file.",
  );
}

export async function extractPdfText(fileBuffer, filePassword) {
  const parser = new PDFParse(createPdfParseOptions(fileBuffer, filePassword));

  try {
    const result = await parser.getText({
      pageJoiner: PDF_PAGE_JOINER,
    });
    return result.text;
  } catch (error) {
    if (error instanceof PasswordException) {
      throw createPdfPasswordError(filePassword);
    }

    throw error;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function normalizeKnownPdfRows(parsedPdf) {
  return parsedPdf.rows.map((row) => ({
    occurredOn: row.occurredOn,
    description: row.description,
    amount: -Math.abs(Number(String(row.amount).replace(",", "."))),
    confidence: 0.94,
    issues: [],
    sourceRow: {
      issuer: parsedPdf.issuer,
    },
    raw: {
      source: parsedPdf.metadata?.issuerName ?? "pdf",
    },
  }));
}

function hasSelectableText(text) {
  const normalized = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length >= 20;
}

export async function parsePdfTextBuffer(fileBuffer, options = {}) {
  const text =
    typeof options.text === "string"
      ? options.text
      : await (options.extractText ?? extractPdfText)(fileBuffer, options.filePassword);

  if (!hasSelectableText(text)) {
    throw buildNoSelectableTextError();
  }

  try {
    const parsedPdf = parseCreditCardPdfStatement({
      text,
      filename: options.filename,
    });

    if (parsedPdf.rows.length > 0) {
      return {
        rows: normalizeKnownPdfRows(parsedPdf),
        metadata: parsedPdf.metadata,
        sourceKind: "credit_card_statement",
        sourceKindConfidence: 0.96,
      };
    }
  } catch {
    // Fallback to generic line parser below.
  }

  const rows = parseTextLines(text.split(/\r?\n/), {
    referenceYear: options.referenceYear,
  });

  if (rows.length === 0) {
    throw new ImportHttpError("import_pdf_parse_failed", "Não foi possível localizar transações válidas no PDF.");
  }

  const issuer = detectPdfIssuer(text, options.filename);

  return {
    rows: rows.map((row) => ({
      ...row,
      raw: {
        ...row.raw,
        source: issuer ? `pdf:${issuer}` : "pdf",
      },
    })),
    metadata: {
      issuerName: issuer === "inter" ? "Inter" : issuer === "itau" ? "Itau" : null,
      statementDueDate: null,
      statementReferenceMonth: null,
    },
    sourceKind: "unknown",
    sourceKindConfidence: 0.55,
  };
}
