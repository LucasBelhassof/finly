import { parseCsvLikeBuffer } from "./parsers/csv-parser.js";
import { parseJsonBuffer } from "./parsers/json-parser.js";
import { parseOfxBuffer } from "./parsers/ofx-parser.js";
import { parsePdfTextBuffer } from "./parsers/pdf-text-parser.js";
import { parseQifBuffer } from "./parsers/qif-parser.js";
import { parseSpreadsheetBuffer } from "./parsers/spreadsheet-parser.js";
import { parseTextBuffer } from "./parsers/text-parser.js";

export const UNIVERSAL_IMPORT_PARSERS = {
  csv: {
    parserId: "csv-delimited",
    parserLabel: "CSV/TSV parser",
    parse: (input) => parseCsvLikeBuffer(input.fileBuffer, { source: input.filename }),
  },
  tsv: {
    parserId: "csv-delimited",
    parserLabel: "CSV/TSV parser",
    parse: (input) => parseCsvLikeBuffer(input.fileBuffer, { source: input.filename }),
  },
  xlsx: {
    parserId: "spreadsheet-workbook",
    parserLabel: "Spreadsheet parser",
    parse: (input) => parseSpreadsheetBuffer(input.fileBuffer, { filename: input.filename }),
  },
  xls: {
    parserId: "spreadsheet-workbook",
    parserLabel: "Spreadsheet parser",
    parse: (input) => parseSpreadsheetBuffer(input.fileBuffer, { filename: input.filename }),
  },
  ofx: {
    parserId: "ofx-basic",
    parserLabel: "OFX parser",
    parse: (input) => parseOfxBuffer(input.fileBuffer, { filename: input.filename }),
  },
  qif: {
    parserId: "qif-basic",
    parserLabel: "QIF parser",
    parse: (input) => parseQifBuffer(input.fileBuffer, { filename: input.filename }),
  },
  txt: {
    parserId: "text-structured",
    parserLabel: "Structured text parser",
    parse: (input) => parseTextBuffer(input.fileBuffer, { filename: input.filename }),
  },
  json: {
    parserId: "json-transactions",
    parserLabel: "JSON parser",
    parse: (input) => parseJsonBuffer(input.fileBuffer, { filename: input.filename }),
  },
  pdf: {
    parserId: "pdf-text",
    parserLabel: "PDF text parser",
    parse: (input) =>
      parsePdfTextBuffer(input.fileBuffer, {
        filename: input.filename,
        filePassword: input.filePassword,
      }),
  },
};

export function resolveUniversalImportParser(fileType) {
  return UNIVERSAL_IMPORT_PARSERS[fileType] ?? null;
}
