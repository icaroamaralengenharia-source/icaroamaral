(function (root) {
  "use strict";

  const DEFAULT_MAX_XML_BYTES = 1024 * 1024;
  const DECIMAL_TAGS = new Set(["qCom", "vUnCom", "vProd"]);

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function byteLength(value) {
    const text = String(value == null ? "" : value);
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(text).length;
    }
    return text.length;
  }

  function decodeXmlText(value) {
    return String(value == null ? "" : value)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function localName(name) {
    return clean(name).split(":").pop();
  }

  function parseAttributes(source) {
    const attributes = {};
    String(source || "").replace(/([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g, function (_, key, _quoted, doubleValue, singleValue) {
      attributes[localName(key)] = decodeXmlText(doubleValue !== undefined ? doubleValue : singleValue);
      return "";
    });
    return attributes;
  }

  function createNode(name, attributes) {
    return {
      name: localName(name),
      attributes: attributes || {},
      children: [],
      text: ""
    };
  }

  function parseXml(xmlText) {
    const source = String(xmlText || "").replace(/^\uFEFF/, "");
    if (!source.trim()) {
      throw new Error("xml_empty");
    }
    if (/<!DOCTYPE\b/i.test(source) || /<!ENTITY\b/i.test(source)) {
      throw new Error("xml_external_entities_not_allowed");
    }

    const rootNode = createNode("#document");
    const stack = [rootNode];
    const tokenPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w:.-]*(?:\s+[^<>]*?)?\s*\/?>|<[^>]*>/g;
    let lastIndex = 0;
    let match;

    while ((match = tokenPattern.exec(source))) {
      const textBetween = source.slice(lastIndex, match.index);
      if (textBetween) {
        stack[stack.length - 1].text += textBetween;
      }

      const token = match[0];
      lastIndex = tokenPattern.lastIndex;

      if (token.startsWith("<!--") || token.startsWith("<?")) {
        continue;
      }
      if (token.startsWith("<![CDATA[")) {
        stack[stack.length - 1].text += token.slice(9, -3);
        continue;
      }
      if (/^<\//.test(token)) {
        const closingName = localName(token.slice(2, -1));
        const current = stack.pop();
        if (!current || current.name !== closingName || stack.length < 1) {
          throw new Error("xml_malformed");
        }
        continue;
      }
      if (/^<[^A-Za-z_]/.test(token)) {
        throw new Error("xml_malformed");
      }

      const selfClosing = /\/>$/.test(token);
      const inner = token.slice(1, selfClosing ? -2 : -1).trim();
      const firstSpace = inner.search(/\s/);
      const tagName = firstSpace >= 0 ? inner.slice(0, firstSpace) : inner;
      const attrSource = firstSpace >= 0 ? inner.slice(firstSpace + 1) : "";
      const node = createNode(tagName, parseAttributes(attrSource));
      stack[stack.length - 1].children.push(node);
      if (!selfClosing) {
        stack.push(node);
      }
    }

    const remainingText = source.slice(lastIndex);
    if (remainingText) {
      stack[stack.length - 1].text += remainingText;
    }
    if (stack.length !== 1) {
      throw new Error("xml_malformed");
    }
    if (!rootNode.children.length) {
      throw new Error("xml_malformed");
    }
    return rootNode;
  }

  function child(node, name) {
    return (node && node.children || []).find(function (item) {
      return item.name === name;
    }) || null;
  }

  function children(node, name) {
    return (node && node.children || []).filter(function (item) {
      return item.name === name;
    });
  }

  function descendants(node, name, result) {
    const found = result || [];
    (node && node.children || []).forEach(function (item) {
      if (item.name === name) {
        found.push(item);
      }
      descendants(item, name, found);
    });
    return found;
  }

  function textOf(node, name) {
    const item = child(node, name);
    if (!item) return "";
    return clean(decodeXmlText(item.text));
  }

  function rawDecimalOf(node, name) {
    const item = child(node, name);
    if (!item) return "";
    return clean(decodeXmlText(item.text));
  }

  function findNfeNode(documentNode) {
    const nfeNodes = descendants(documentNode, "NFe");
    return nfeNodes.find(function (candidate) {
      return !!descendants(candidate, "infNFe").length;
    }) || null;
  }

  function findInfNfeNode(nfeNode) {
    return descendants(nfeNode, "infNFe")[0] || null;
  }

  function accessKeyFrom(documentNode, infNfe) {
    const id = clean(infNfe && infNfe.attributes && infNfe.attributes.Id);
    const fromId = id.replace(/^NFe/i, "");
    if (/^\d{44}$/.test(fromId)) {
      return fromId;
    }
    const protKey = textOf(descendants(documentNode, "infProt")[0], "chNFe");
    if (/^\d{44}$/.test(protKey)) {
      return protKey;
    }
    return "";
  }

  function addMissingWarning(warnings, code, value) {
    if (!clean(value)) {
      warnings.push(code);
    }
  }

  function parseNfeXml(input, options) {
    const settings = options || {};
    const maxBytes = Number(settings.maxBytes || DEFAULT_MAX_XML_BYTES);
    const xmlText = typeof input === "string" ? input : String(input == null ? "" : input);
    if (byteLength(xmlText) > maxBytes) {
      return { ok: false, error: "xml_too_large", maxBytes };
    }

    let documentNode;
    try {
      documentNode = parseXml(xmlText);
    } catch (error) {
      return { ok: false, error: clean(error && error.message) || "xml_invalid" };
    }

    const nfeNode = findNfeNode(documentNode);
    const infNfe = findInfNfeNode(nfeNode);
    if (!nfeNode || !infNfe) {
      return { ok: false, error: "xml_not_nfe" };
    }

    const ide = descendants(infNfe, "ide")[0] || null;
    const emit = descendants(infNfe, "emit")[0] || null;
    const warnings = [];
    const items = children(infNfe, "det").map(function (detNode) {
      const prod = child(detNode, "prod") || createNode("prod");
      const item = {
        lineNumber: clean(detNode.attributes && detNode.attributes.nItem),
        code: textOf(prod, "cProd"),
        description: textOf(prod, "xProd"),
        ncm: textOf(prod, "NCM"),
        unit: textOf(prod, "uCom"),
        quantity: rawDecimalOf(prod, "qCom"),
        unitValue: rawDecimalOf(prod, "vUnCom"),
        totalValue: rawDecimalOf(prod, "vProd")
      };
      Object.keys(item).forEach(function (key) {
        if (key !== "lineNumber" && !clean(item[key])) {
          warnings.push("item_" + key + "_missing");
        }
      });
      return item;
    });

    const draft = {
      version: "stock-full-nfe-draft/v1",
      accessKey: accessKeyFrom(documentNode, infNfe),
      number: textOf(ide, "nNF"),
      issuedAt: textOf(ide, "dhEmi") || textOf(ide, "dEmi"),
      supplier: {
        name: textOf(emit, "xNome"),
        cnpj: textOf(emit, "CNPJ")
      },
      items
    };

    addMissingWarning(warnings, "access_key_missing", draft.accessKey);
    addMissingWarning(warnings, "number_missing", draft.number);
    addMissingWarning(warnings, "issued_at_missing", draft.issuedAt);
    addMissingWarning(warnings, "supplier_name_missing", draft.supplier.name);
    addMissingWarning(warnings, "supplier_cnpj_missing", draft.supplier.cnpj);
    if (!items.length) {
      warnings.push("items_missing");
    }

    return {
      ok: true,
      draft,
      warnings: Array.from(new Set(warnings)),
      metadata: {
        itemCount: items.length,
        decimalFieldsPreserved: Array.from(DECIMAL_TAGS)
      }
    };
  }

  const api = {
    parseNfeXml,
    maxXmlBytes: DEFAULT_MAX_XML_BYTES
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.StockFullNfeReader = api;
})(typeof window !== "undefined" ? window : globalThis);
