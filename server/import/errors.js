export class ImportHttpError extends Error {
  constructor(code, message, details = undefined, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createImportPdfPasswordError(filePassword) {
  return new ImportHttpError(
    filePassword ? "import_pdf_password_invalid" : "import_pdf_password_required",
    filePassword
      ? "Senha do PDF incorreta. Verifique e tente novamente."
      : "Informe a senha do PDF para gerar a prévia.",
    { requiresPassword: true },
  );
}

export function createImportUnsupportedFileError(filename) {
  return new ImportHttpError(
    "import_unsupported_file_type",
    `O arquivo ${String(filename ?? "selecionado")} não é suportado por esta importação.`,
  );
}
