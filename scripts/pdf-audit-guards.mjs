export const PDF_LEAK_PATTERNS = [
  { id: "nan_token", pattern: /(?<![A-Za-zÀ-ÿ])NaN(?![A-Za-zÀ-ÿ])/g },
  { id: "money_nan", pattern: /R\$\s*NaN(?![A-Za-zÀ-ÿ])/g },
  { id: "area_nan", pattern: /(?<![A-Za-zÀ-ÿ])NaN\s*(?:m²|m2|m³|m3)(?![A-Za-zÀ-ÿ])/g },
  { id: "percent_nan", pattern: /(?<![A-Za-zÀ-ÿ])NaN\s*%(?![A-Za-zÀ-ÿ])/g },
  { id: "undefined_token", pattern: /(?<![A-Za-zÀ-ÿ])undefined(?![A-Za-zÀ-ÿ])/gi },
  { id: "null_token", pattern: /(?<![A-Za-zÀ-ÿ])null(?![A-Za-zÀ-ÿ])/gi },
  { id: "object_object", pattern: /\[object Object\]/g }
];

export function findPdfTextLeaks(text = "") {
  const source = String(text || "");
  const leaks = [];
  PDF_LEAK_PATTERNS.forEach(({ id, pattern }) => {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(source.length, match.index + match[0].length + 80);
      leaks.push({
        id,
        value: match[0],
        index: match.index,
        excerpt: source.slice(start, end).replace(/\s+/g, " ").trim()
      });
      match = pattern.exec(source);
    }
  });
  return leaks;
}

export function hasPdfTextLeaks(text = "") {
  return findPdfTextLeaks(text).length > 0;
}
