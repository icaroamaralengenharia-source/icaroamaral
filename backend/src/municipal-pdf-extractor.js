function cleanText(value) {
  return String(value == null ? "" : value).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function normalizePages(rawText) {
  const text = cleanText(rawText);
  if (!text) return [];
  return text.split(/\n\s*(?:---\s*page\s*\d+\s*---|\f)\s*\n/i)
    .map((pageText, index) => ({ page: index + 1, text: cleanText(pageText) }))
    .filter((page) => page.text);
}

function rowsFromPages(pages) {
  return pages.flatMap((page) => page.text
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean)
    .map((text) => ({ page: page.page, text })));
}

function tablesFromRows(rows) {
  return rows
    .filter((row) => /[|\t;]/.test(row.text))
    .map((row) => ({
      page: row.page,
      cells: row.text.split(/[|\t;]/).map(cleanText).filter(Boolean)
    }))
    .filter((row) => row.cells.length > 1);
}

function extractMunicipalTextContent(rawText) {
  const pages = normalizePages(rawText);
  const rows = rowsFromPages(pages);
  const tables = tablesFromRows(rows);
  return {
    rawText: pages.map((page) => page.text).join("\n\n"),
    pages,
    tables,
    rows
  };
}

async function extractMunicipalPdfContent(buffer) {
  try {
    const pdfParse = await import("pdf-parse");
    let result;

    if (pdfParse.PDFParse) {
      const parser = new pdfParse.PDFParse({ data: buffer });
      try {
        result = await parser.getText({ max: 100 });
      } finally {
        if (typeof parser.destroy === "function") await parser.destroy();
      }
    } else {
      const parser = pdfParse.default || pdfParse;
      result = await parser(buffer, { max: 100 });
    }

    return extractMunicipalTextContent(result && result.text ? result.text : "");
  } catch {
    const err = new Error("municipal_pdf_text_extraction_failed");
    err.status = 422;
    err.code = "municipal_pdf_text_extraction_failed";
    throw err;
  }
}

export { extractMunicipalPdfContent, extractMunicipalTextContent };
