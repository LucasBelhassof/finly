import {
  buildIssue,
  decodeTextBuffer,
  detectDelimiter,
  findHeaderRowIndex,
  isLikelyNoiseRow,
  normalizeAmountInput,
  normalizeDateInput,
  resolveHeaderIndexes,
  splitDelimitedLine,
} from "./tabular-utils.js";

function buildRawRow(headers, cells, rowNumber, source) {
  if (headers.length > 0) {
    return Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, cells[index] ?? ""]));
  }

  return Object.fromEntries(cells.map((cell, index) => [`column_${index + 1}`, cell ?? ""]));
}

function inferColumnIndexes(cells) {
  const values = cells.map((cell) => String(cell ?? "").trim());
  const dateIndex = values.findIndex((value) => normalizeDateInput(value) !== null);
  const amountCandidates = values
    .map((value, index) => [index, normalizeAmountInput(value)])
    .filter(([, amount]) => amount !== null);
  const amountIndex = amountCandidates.length > 0 ? amountCandidates[amountCandidates.length - 1][0] : -1;
  const descriptionIndex = values.findIndex(
    (value, index) =>
      index !== dateIndex &&
      index !== amountIndex &&
      value &&
      normalizeDateInput(value) === null &&
      normalizeAmountInput(value) === null,
  );

  return {
    date: dateIndex,
    description: descriptionIndex,
    amount: amountIndex,
    debit: -1,
    credit: -1,
    balance: -1,
    type: -1,
    currency: -1,
    externalId: -1,
  };
}

function resolveSignedAmount(cells, indexes) {
  if (indexes.amount >= 0) {
    return normalizeAmountInput(cells[indexes.amount]);
  }

  const debit = indexes.debit >= 0 ? normalizeAmountInput(cells[indexes.debit]) : null;
  const credit = indexes.credit >= 0 ? normalizeAmountInput(cells[indexes.credit]) : null;

  if (credit !== null && Math.abs(credit) > 0) {
    return Math.abs(credit);
  }

  if (debit !== null && Math.abs(debit) > 0) {
    return -Math.abs(debit);
  }

  return null;
}

function normalizeTabularRows(rows, source, options = {}) {
  const headerRowIndex = findHeaderRowIndex(rows);
  const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : [];
  const headers = headerRowIndex >= 0 ? headerRow.map((value) => String(value ?? "").trim()) : [];
  const headerIndexes = headerRowIndex >= 0 ? resolveHeaderIndexes(headerRow) : null;
  const dataRows = rows.slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 0);
  const output = [];
  let previousOccurredOn = null;

  dataRows.forEach((cells, index) => {
    if (!Array.isArray(cells) || cells.every((cell) => !String(cell ?? "").trim())) {
      return;
    }

    const columnIndexes = headerIndexes ?? inferColumnIndexes(cells);
    const occurredOn = columnIndexes.date >= 0 ? normalizeDateInput(cells[columnIndexes.date], options) : null;
    const description = columnIndexes.description >= 0 ? String(cells[columnIndexes.description] ?? "").trim() : "";
    const signedAmount = resolveSignedAmount(cells, columnIndexes);
    const issues = [];

    if (signedAmount === null && isLikelyNoiseRow(cells)) {
      return;
    }

    let finalOccurredOn = occurredOn;

    if (!finalOccurredOn && previousOccurredOn && signedAmount !== null) {
      finalOccurredOn = previousOccurredOn;
      issues.push(
        buildIssue("import_inferred_date", "A data desta linha foi inferida a partir da linha anterior.", "warning"),
      );
    }

    if (!finalOccurredOn && signedAmount === null && isLikelyNoiseRow(cells)) {
      return;
    }

    if (!description && !finalOccurredOn && signedAmount === null) {
      return;
    }

    if (!finalOccurredOn) {
      finalOccurredOn = options.fallbackOccurredOn ?? new Date().toISOString().slice(0, 10);
      issues.push(
        buildIssue("import_missing_date", "Não foi possível identificar a data original desta linha.", "warning"),
      );
    }

    if (!description) {
      issues.push(
        buildIssue(
          "import_missing_description",
          "Não foi possível identificar a descrição original desta linha.",
          "warning",
        ),
      );
    }

    if (signedAmount === null) {
      issues.push(
        buildIssue("import_missing_amount", "Não foi possível identificar o valor original desta linha.", "error"),
      );
    }

    previousOccurredOn = finalOccurredOn ?? previousOccurredOn;

    output.push({
      occurredOn: finalOccurredOn,
      description: description || `Linha ${index + 1}`,
      amount: signedAmount ?? 0,
      externalId: columnIndexes.externalId >= 0 ? String(cells[columnIndexes.externalId] ?? "").trim() || null : null,
      currency: columnIndexes.currency >= 0 ? String(cells[columnIndexes.currency] ?? "").trim() || null : null,
      balanceAfter: columnIndexes.balance >= 0 ? normalizeAmountInput(cells[columnIndexes.balance]) : null,
      confidence: issues.length > 0 ? 0.45 : headerIndexes ? 0.92 : 0.65,
      issues,
      sourceRow: buildRawRow(headers, cells, index + 1, source),
      raw: {
        source,
        cells,
      },
    });
  });

  return output;
}

export function parseCsvLikeText(text, source = "csv") {
  const normalizedText = decodeTextBuffer(Buffer.isBuffer(text) ? text : Buffer.from(String(text ?? ""), "utf8"));
  const lines = normalizedText.split(/\r?\n/).map((line) => line.replace(/\r/g, ""));

  if (!lines.some((line) => line.trim())) {
    return [];
  }

  const delimiter = detectDelimiter(lines.filter((line) => line.trim()));
  const rows = lines
    .map((line) => splitDelimitedLine(line, delimiter))
    .filter((cells) => cells.some((cell) => String(cell ?? "").trim()));

  return normalizeTabularRows(rows, source);
}

export function parseCsvLikeBuffer(fileBuffer, options = {}) {
  const text = decodeTextBuffer(fileBuffer);
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\r/g, ""));

  if (!lines.some((line) => line.trim())) {
    return [];
  }

  const delimiter = detectDelimiter(lines.filter((line) => line.trim()));
  const rows = lines
    .map((line) => splitDelimitedLine(line, delimiter))
    .filter((cells) => cells.some((cell) => String(cell ?? "").trim()));

  return normalizeTabularRows(rows, options.source ?? "csv", options);
}

export function normalizeTabularGrid(rows, options = {}) {
  return normalizeTabularRows(rows, options.source ?? "sheet", options);
}
