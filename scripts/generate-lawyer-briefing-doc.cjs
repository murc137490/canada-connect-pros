/**
 * Script to compile docs/LAWYER_PLATFORM_FACTUAL_BRIEFING.md into:
 * 1. docs/Premiere_Services_Factual_Platform_Briefing_for_Counsel.html (and docs/LAWYER_PLATFORM_FACTUAL_BRIEFING.html)
 * 2. docs/Premiere_Services_Factual_Platform_Briefing_for_Counsel.pdf (and docs/LAWYER_PLATFORM_FACTUAL_BRIEFING.pdf) via Edge
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const mdPath = path.join(rootDir, "docs", "LAWYER_PLATFORM_FACTUAL_BRIEFING.md");
const mdContent = fs.readFileSync(mdPath, "utf8");

// Simple, robust Markdown-to-HTML parser tailored to briefing format
function parseMarkdown(md) {
  const lines = md.split(/\r?\n/);
  let html = "";
  let inTable = false;
  let tableHeaderParsed = false;
  let inList = false;
  let listType = null; // 'ul' or 'ol'
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines = [];

  function closeList() {
    if (inList) {
      html += `</${listType}>\n`;
      inList = false;
      listType = null;
    }
  }

  function closeTable() {
    if (inTable) {
      html += `</tbody></table></div>\n`;
      inTable = false;
      tableHeaderParsed = false;
    }
  }

  function closeCodeBlock() {
    if (inCodeBlock) {
      const code = escapeHtml(codeBlockLines.join("\n"));
      html += `<pre><code class="language-${codeBlockLang}">${code}</code></pre>\n`;
      inCodeBlock = false;
      codeBlockLines = [];
      codeBlockLang = "";
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        closeCodeBlock();
      } else {
        closeList();
        closeTable();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Tables
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      closeList();
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      // Check if this is a separator row (e.g. |---|---|)
      const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));

      if (isSeparator) {
        tableHeaderParsed = true;
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaderParsed = false;
        html += `<div class="table-container"><table><thead><tr>\n`;
        cells.forEach((cell) => {
          html += `<th>${formatInline(cell)}</th>\n`;
        });
        html += `</tr></thead><tbody>\n`;
      } else {
        html += `<tr>\n`;
        cells.forEach((cell) => {
          html += `<td>${formatInline(cell)}</td>\n`;
        });
        html += `</tr>\n`;
      }
      continue;
    } else {
      closeTable();
    }

    // Horizontal rule
    if (/^---{2,}$/.test(trimmed)) {
      closeList();
      html += `<hr />\n`;
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      closeList();
      html += `<h1>${formatInline(trimmed.slice(2))}</h1>\n`;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      html += `<h2>${formatInline(trimmed.slice(3))}</h2>\n`;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeList();
      html += `<h3>${formatInline(trimmed.slice(4))}</h3>\n`;
      continue;
    }
    if (trimmed.startsWith("#### ")) {
      closeList();
      html += `<h4>${formatInline(trimmed.slice(5))}</h4>\n`;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      closeList();
      html += `<blockquote>${formatInline(trimmed.slice(2))}</blockquote>\n`;
      continue;
    }

    // Unordered lists (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        closeList();
        inList = true;
        listType = "ul";
        html += `<ul>\n`;
      }
      html += `<li>${formatInline(ulMatch[1])}</li>\n`;
      continue;
    }

    // Ordered lists (1. or 2.)
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        closeList();
        inList = true;
        listType = "ol";
        html += `<ol>\n`;
      }
      html += `<li>${formatInline(olMatch[2])}</li>\n`;
      continue;
    }

    // Blank line
    if (trimmed === "") {
      closeList();
      continue;
    }

    // Normal paragraph
    closeList();
    html += `<p>${formatInline(trimmed)}</p>\n`;
  }

  closeList();
  closeTable();
  closeCodeBlock();

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInline(text) {
  // Bold + italic (***text*** or ___text___)
  let s = text.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold (**text**)
  s = s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic (*text* or _text_)
  s = s.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Inline code (`code`)
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Links ([label](url))
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}

const bodyHtml = parseMarkdown(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Première Services — Lawyer-Ready Factual Platform Description</title>
  <style>
    :root {
      --primary: #0f172a;
      --primary-light: #1e293b;
      --accent: #2563eb;
      --text: #1e293b;
      --text-muted: #64748b;
      --bg: #ffffff;
      --card-bg: #f8fafc;
      --border: #e2e8f0;
      --table-header-bg: #f1f5f9;
      --code-bg: #f1f5f9;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text);
      background: #f1f5f9;
      padding: 40px 20px;
    }

    .document-wrapper {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      padding: 60px 70px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid var(--border);
    }

    /* Header & Letterhead */
    .memo-header {
      border-bottom: 2px solid var(--primary);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }

    .memo-badge {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 4px;
      border: 1px solid #bfdbfe;
      margin-bottom: 12px;
    }

    .memo-title {
      font-size: 26px;
      font-weight: 800;
      color: var(--primary);
      line-height: 1.25;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }

    .memo-subtitle {
      font-size: 15px;
      color: var(--text-muted);
      margin-bottom: 20px;
    }

    .memo-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 16px 20px;
      font-size: 13px;
    }

    .memo-meta-item strong {
      color: var(--primary);
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }

    /* Headings */
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: var(--primary);
      margin-top: 40px;
      margin-bottom: 16px;
      border-bottom: 1.5px solid var(--border);
      padding-bottom: 8px;
      page-break-after: avoid;
      break-after: avoid;
    }

    h2 {
      font-size: 16px;
      font-weight: 700;
      color: var(--primary-light);
      margin-top: 28px;
      margin-bottom: 12px;
      page-break-after: avoid;
      break-after: avoid;
    }

    h3 {
      font-size: 14.5px;
      font-weight: 600;
      color: #334155;
      margin-top: 20px;
      margin-bottom: 8px;
      page-break-after: avoid;
      break-after: avoid;
    }

    h4 {
      font-size: 13.5px;
      font-weight: 600;
      color: #475569;
      margin-top: 16px;
      margin-bottom: 6px;
    }

    p {
      margin-bottom: 14px;
    }

    /* Lists */
    ul, ol {
      margin-top: 6px;
      margin-bottom: 16px;
      padding-left: 26px;
    }

    li {
      margin-bottom: 6px;
    }

    li strong {
      color: var(--primary);
    }

    /* Tables */
    .table-container {
      width: 100%;
      overflow-x: auto;
      margin-top: 14px;
      margin-bottom: 22px;
      border: 1px solid var(--border);
      border-radius: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
      text-align: left;
    }

    th {
      background: var(--table-header-bg);
      color: var(--primary);
      font-weight: 700;
      padding: 10px 14px;
      border-bottom: 1.5px solid var(--border);
      font-size: 12px;
      letter-spacing: 0.02em;
    }

    td {
      padding: 8px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) td {
      background: #fafbfc;
    }

    /* Code */
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 11.5px;
      background: var(--code-bg);
      color: #0f172a;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 14px 18px;
      border-radius: 6px;
      overflow-x: auto;
      margin-top: 10px;
      margin-bottom: 18px;
      font-size: 12px;
      line-height: 1.5;
    }

    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border: none;
    }

    blockquote {
      border-left: 4px solid var(--accent);
      background: #f8fafc;
      padding: 10px 16px;
      margin: 14px 0;
      border-radius: 0 6px 6px 0;
      color: #334155;
      font-size: 13.5px;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 32px 0;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    /* Print Styles for PDF Generation */
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        color: #000000 !important;
        font-size: 11pt !important;
      }

      .document-wrapper {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }

      @page {
        margin: 20mm 15mm 20mm 15mm;
        size: letter portrait;
      }

      h1, h2, h3 {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      .table-container, table, tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      pre, blockquote {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="document-wrapper">
    <div class="memo-header">
      <div class="memo-badge">Technical Briefing for Legal Counsel</div>
      <div class="memo-title">Première Services — Comprehensive Factual Platform Audit</div>
      <div class="memo-subtitle">Technical Architecture, User Flows, Marketplace Mechanics, Data Inventory & Regulatory Touchpoints</div>
      <div class="memo-meta-grid">
        <div class="memo-meta-item">
          <strong>Subject Entity</strong>
          Première Services (premiereservices.ca)
        </div>
        <div class="memo-meta-item">
          <strong>Document Purpose</strong>
          Save legal fees during ToS / Privacy / Regulatory review
        </div>
        <div class="memo-meta-item">
          <strong>Audit Date</strong>
          September 2026 (Codebase & Live Schema)
        </div>
        <div class="memo-meta-item">
          <strong>Reviewing Counsel</strong>
          Quebec Bar / Commercial & Regulatory Practice
        </div>
      </div>
    </div>

    ${bodyHtml}
  </div>
</body>
</html>
`;

// Save HTML files
const outHtml1 = path.join(rootDir, "docs", "Premiere_Services_Factual_Platform_Briefing_for_Counsel.html");
const outHtml2 = path.join(rootDir, "docs", "LAWYER_PLATFORM_FACTUAL_BRIEFING.html");
fs.writeFileSync(outHtml1, fullHtml, "utf8");
fs.writeFileSync(outHtml2, fullHtml, "utf8");
console.log(`Generated HTML: ${outHtml1}`);
console.log(`Generated HTML: ${outHtml2}`);

// Generate PDF via Microsoft Edge
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
if (fs.existsSync(edgePath)) {
  const outPdf1 = path.join(rootDir, "docs", "Premiere_Services_Factual_Platform_Briefing_for_Counsel.pdf");
  const outPdf2 = path.join(rootDir, "docs", "LAWYER_PLATFORM_FACTUAL_BRIEFING.pdf");

  try {
    const cmd1 = `"${edgePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${outPdf1}" "${outHtml1}"`;
    execSync(cmd1, { stdio: "inherit" });
    console.log(`Generated PDF: ${outPdf1} (${(fs.statSync(outPdf1).size / 1024).toFixed(1)} KB)`);

    fs.copyFileSync(outPdf1, outPdf2);
    console.log(`Generated PDF: ${outPdf2}`);
  } catch (err) {
    console.error("Error generating PDF with Edge:", err.message);
  }
} else {
  console.warn("Microsoft Edge not found at standard path; PDF generation skipped.");
}
