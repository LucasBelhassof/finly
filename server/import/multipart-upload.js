export function parseMultipartUpload(contentType, bodyBuffer) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    throw new Error("Não foi possível ler o upload do arquivo.");
  }

  if (!Buffer.isBuffer(bodyBuffer) || !bodyBuffer.length) {
    throw new Error("Nenhum arquivo foi enviado.");
  }

  const multipartText = bodyBuffer.toString("latin1");
  const parts = multipartText.split(`--${boundary}`);
  const upload = {
    filename: "extrato.csv",
    contentType: "text/csv",
    buffer: null,
    filePassword: undefined,
    options: undefined,
  };

  for (const part of parts) {
    const normalizedPart = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const separatorIndex = normalizedPart.indexOf("\r\n\r\n");

    if (separatorIndex < 0) {
      continue;
    }

    const headersText = normalizedPart.slice(0, separatorIndex);
    const contentText = normalizedPart.slice(separatorIndex + 4).replace(/\r\n$/, "");
    const filenameMatch = /filename="([^"]+)"/i.exec(headersText);
    const contentTypeMatch = /content-type:\s*([^\r\n]+)/i.exec(headersText);
    const nameMatch = /name="([^"]+)"/i.exec(headersText);
    const fieldName = nameMatch?.[1];

    if (filenameMatch) {
      upload.filename = filenameMatch[1] ?? "extrato.csv";
      upload.contentType = contentTypeMatch?.[1]?.trim() ?? "text/csv";
      upload.buffer = Buffer.from(contentText, "latin1");
      continue;
    }

    if (fieldName === "filePassword") {
      const filePassword = Buffer.from(contentText, "latin1").toString("utf8").trim();
      upload.filePassword = filePassword || undefined;
      continue;
    }

    if (fieldName === "options") {
      const raw = Buffer.from(contentText, "latin1").toString("utf8").trim();
      upload.options = raw || undefined;
    }
  }

  if (!upload.buffer) {
    throw new Error("O upload não contém um arquivo válido.");
  }

  return upload;
}
