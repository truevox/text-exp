/**
 * Tests for Multi-Format Parser System
 */

// Import jest for globals if needed
import { readFileSync } from "fs";
import { join } from "path";
import { MultiFormatParser } from "../../src/parsers/index.js";
import { detectFormat } from "../../src/utils/detectFormat.js";
import type { SnippetDoc } from "../../src/types/snippet-formats.js";

// Helper to read fixture files
function readFixture(filename: string): string {
  return readFileSync(join(process.cwd(), "tests/fixtures", filename), "utf-8");
}

describe("Multi-Format Parser System", () => {
  let parser: MultiFormatParser;

  beforeEach(() => {
    parser = new MultiFormatParser();
  });

  describe("Format Detection", () => {
    test("detects JSON format correctly", () => {
      const content = readFixture("sample.json");
      expect(detectFormat("sample.json", content)).toBe("json");
      expect(detectFormat("", content)).toBe("json"); // Content-based detection
    });

    test("detects TXT format correctly", () => {
      const content = readFixture("sample.txt");
      expect(detectFormat("sample.txt", content)).toBe("txt");
      expect(detectFormat("sample.ppp.txt", content)).toBe("txt");
    });

    test("detects Markdown format correctly", () => {
      const content = readFixture("sample.md");
      expect(detectFormat("sample.md", content)).toBe("md");
      expect(detectFormat("sample.markdown", content)).toBe("md");
    });

    test("detects HTML format correctly", () => {
      const content = readFixture("sample.html");
      expect(detectFormat("sample.html", content)).toBe("html");
      expect(detectFormat("", content)).toBe("html"); // Content-based detection
    });

    test("detects LaTeX format correctly", () => {
      const content = readFixture("sample.tex");
      expect(detectFormat("sample.tex", content)).toBe("tex");
      expect(detectFormat("", content)).toBe("tex"); // Content-based detection
    });
  });

  describe("JSON Format Parsing", () => {
    test("parses JSON fixture correctly", () => {
      const content = readFixture("sample.json");
      const result = parser.parseAs(content, "json");

      expect(Array.isArray(result)).toBe(true);
      const docs = result as SnippetDoc[];
      expect(docs).toHaveLength(2);

      const firstDoc = docs[0];
      expect(firstDoc.meta.trigger).toBe("hello");
      expect(firstDoc.meta.description).toBe("Simple greeting");
      expect(firstDoc.body).toBe("Hello {name}! How are you today?");
      expect(firstDoc.format).toBe("json");
    });

    test("validates JSON format", () => {
      const content = readFixture("sample.json");
      const validation = parser.validate(content, "json");
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test("serializes JSON format", () => {
      const content = readFixture("sample.json");
      const parsed = parser.parseAs(content, "json") as SnippetDoc[];
      const serialized = parser.serialize(parsed, "json");

      // Should be valid JSON
      expect(() => JSON.parse(serialized)).not.toThrow();

      // Should contain expected content
      expect(serialized).toContain("hello");
      expect(serialized).toContain("signature");
    });
  });

  describe("Plain Text Format Parsing", () => {
    test("parses TXT fixture correctly", () => {
      const content = readFixture("sample.txt");
      const result = parser.parseAs(content, "txt");

      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.meta.trigger).toBe("contact");
      expect(doc.meta.description).toBe("Contact information template");
      expect(doc.body).toContain("Contact Information:");
      expect(doc.format).toBe("txt");
    });

    test("validates TXT format", () => {
      const content = readFixture("sample.txt");
      const validation = parser.validate(content, "txt");
      expect(validation.valid).toBe(true);
    });

    test("round-trip serialization for TXT", () => {
      const content = readFixture("sample.txt");
      const parsed = parser.parseAs(content, "txt") as SnippetDoc;
      const serialized = parser.serialize(parsed, "txt");
      const reparsed = parser.parseAs(serialized, "txt") as SnippetDoc;

      expect(reparsed.meta.trigger).toBe(parsed.meta.trigger);
      expect(reparsed.meta.description).toBe(parsed.meta.description);
      expect(reparsed.body.trim()).toBe(parsed.body.trim());
    });
  });

  describe("Markdown Format Parsing", () => {
    test("parses Markdown fixture correctly", () => {
      const content = readFixture("sample.md");
      const result = parser.parseAs(content, "md");

      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.meta.trigger).toBe("readme");
      expect(doc.meta.description).toBe("README template for projects");
      expect(doc.body).toContain("# {projectName}");
      expect(doc.format).toBe("md");
      expect(doc.meta.variables.some((v) => v.name === "projectName")).toBe(
        true,
      );
      expect(doc.meta.variables.some((v) => v.name === "description")).toBe(
        true,
      );
    });

    test("extracts variables from Markdown", () => {
      const content = readFixture("sample.md");
      const result = parser.parseAs(content, "md") as SnippetDoc;

      expect(result.meta.variables.map((v) => v.name)).toEqual(
        expect.arrayContaining(["projectName", "description"]),
      );
    });

    test("validates Markdown format", () => {
      const content = readFixture("sample.md");
      const validation = parser.validate(content, "md");
      expect(validation.valid).toBe(true);
    });
  });

  describe("HTML Format Parsing", () => {
    test("parses HTML fixture correctly", () => {
      const content = readFixture("sample.html");
      const result = parser.parseAs(content, "html");

      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.meta.trigger).toBe("card");
      expect(doc.meta.description).toBe("Responsive card component");
      expect(doc.body).toContain('<div class="card"');
      expect(doc.format).toBe("html");
      expect(doc.meta.variables.some((v) => v.name === "title")).toBe(true);
      expect(doc.meta.images).toContain("https://example.com/placeholder.jpg");
    });

    test("extracts images from HTML", () => {
      const content = readFixture("sample.html");
      const result = parser.parseAs(content, "html") as SnippetDoc;

      expect(result.meta.images).toEqual(
        expect.arrayContaining(["https://example.com/placeholder.jpg"]),
      );
    });

    test("sanitizes HTML content by default", () => {
      const maliciousHTML = `<!-- YAML
trigger: "test"
-->
<div onclick="alert('xss')">Safe content</div>
<script>alert('xss')</script>`;

      const result = parser.parseAs(maliciousHTML, "html", undefined, {
        sanitizeHtml: true,
      }) as SnippetDoc;

      // Script should be removed
      expect(result.body).not.toContain("<script>");
      expect(result.body).not.toContain("onclick");
      expect(result.body).toContain("Safe content");
    });

    test("validates HTML format", () => {
      const content = readFixture("sample.html");
      const validation = parser.validate(content, "html");
      expect(validation.valid).toBe(true);
    });
  });

  describe("LaTeX Format Parsing", () => {
    test("parses LaTeX fixture correctly", () => {
      const content = readFixture("sample.tex");
      const result = parser.parseAs(content, "tex");

      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.meta.trigger).toBe("theorem");
      expect(doc.meta.description).toBe("Mathematical theorem template");
      expect(doc.body).toContain("\\begin{theorem}");
      expect(doc.format).toBe("tex");
      expect(doc.meta.variables.some((v) => v.name === "theoremName")).toBe(
        true,
      );
    });

    test("extracts LaTeX variables", () => {
      const content = readFixture("sample.tex");
      const result = parser.parseAs(content, "tex") as SnippetDoc;

      expect(result.meta.variables.map((v) => v.name)).toEqual(
        expect.arrayContaining(["theoremName", "statement", "proof"]),
      );
    });

    test("validates LaTeX format", () => {
      const content = readFixture("sample.tex");
      const validation = parser.validate(content, "tex");
      expect(validation.valid).toBe(true);
    });

    test("detects unmatched LaTeX environments", () => {
      const invalidLaTeX = `---
trigger: "bad"
---
\\begin{theorem}
Some content
\\end{proof}`;

      const validation = parser.validate(invalidLaTeX, "tex");
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((err) => err.includes("environment"))).toBe(
        true,
      );
    });
  });

  describe("Format Conversion", () => {
    test("converts between formats", () => {
      const content = readFixture("sample.txt");
      const parsed = parser.parseAs(content, "txt") as SnippetDoc;

      const converted = parser.convertFormat(parsed, "md") as SnippetDoc;
      expect(converted.format).toBe("md");
      expect(converted.meta.contentType).toBe("markdown");
      expect(converted.body).toBe(parsed.body); // Content should remain the same
    });

    test("converts array of documents", () => {
      const content = readFixture("sample.json");
      const parsed = parser.parseAs(content, "json") as SnippetDoc[];

      const converted = parser.convertFormat(parsed, "txt") as SnippetDoc[];
      expect(converted).toHaveLength(2);
      expect(converted[0].format).toBe("txt");
      expect(converted[1].format).toBe("txt");
    });
  });

  describe("Automatic Format Detection and Parsing", () => {
    test("automatically detects and parses JSON", () => {
      const content = readFixture("sample.json");
      const result = parser.parse(content, "sample.json");

      expect(Array.isArray(result)).toBe(true);
      const docs = result as SnippetDoc[];
      expect(docs[0].format).toBe("json");
    });

    test("automatically detects and parses Markdown", () => {
      const content = readFixture("sample.md");
      const result = parser.parse(content, "sample.md");

      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.format).toBe("md");
    });
  });

  describe("Multiple File Parsing", () => {
    test("parses multiple files with different formats", () => {
      const files = [
        { content: readFixture("sample.json"), fileName: "sample.json" },
        { content: readFixture("sample.md"), fileName: "sample.md" },
        { content: readFixture("sample.html"), fileName: "sample.html" },
      ];

      const results = parser.parseMultiple(files);

      // JSON has 2 docs, MD and HTML have 1 each = 4 total
      expect(results).toHaveLength(4);

      const formats = results.map((doc) => doc.format);
      expect(formats.filter((f) => f === "json")).toHaveLength(2);
      expect(formats.filter((f) => f === "md")).toHaveLength(1);
      expect(formats.filter((f) => f === "html")).toHaveLength(1);
    });
  });

  describe("Error Handling", () => {
    test("handles invalid JSON gracefully", () => {
      const invalidJSON = "{ invalid json }";

      expect(() => parser.parseAs(invalidJSON, "json")).toThrow();
    });

    test("handles missing required fields", () => {
      const invalidYAML = `---
description: "Missing trigger"
---
Some content`;

      expect(() => parser.parseAs(invalidYAML, "txt")).toThrow(
        "Missing required field: trigger",
      );
    });

    test("validates format support", () => {
      expect(parser.isFormatSupported("json")).toBe(true);
      expect(parser.isFormatSupported("invalid")).toBe(false);
    });

    test("handles malformed YAML frontmatter", () => {
      const malformedYAML = `---
trigger: "test"
invalid: [unclosed array
---
Content`;

      expect(() => parser.parseAs(malformedYAML, "md")).toThrow();
    });

    test("handles empty content", () => {
      const validation = parser.validate("", "txt");
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Content cannot be empty");
    });

    test("handles unsupported parser format", () => {
      expect(() => parser.parseAs("content", "unsupported" as any)).toThrow(
        "No parser available",
      );
    });

    test("handles serialization with missing format", () => {
      const docWithoutFormat = {
        meta: { trigger: "test" },
        body: "test",
      } as any;
      const result = parser.serialize(docWithoutFormat); // Should default to json
      expect(result).toContain('"trigger":"test"');
    });
  });

  describe("Edge Cases", () => {
    test("handles LaTeX with complex nested environments", () => {
      const complexLaTeX = `---
trigger: "complex"
description: "Complex nested LaTeX"
---
\\begin{theorem}
  \\begin{proof}
    \\begin{equation}
      x = \\frac{a}{b}
    \\end{equation}
  \\end{proof}
\\end{theorem}`;

      const result = parser.parseAs(complexLaTeX, "tex") as SnippetDoc;
      expect(result.meta.trigger).toBe("complex");
      expect(result.body).toContain("\\begin{theorem}");
    });

    test("handles HTML with unusual tag structures", () => {
      const unusualHTML = `<!-- YAML
trigger: "unusual"
description: "Unusual HTML structure"
-->
<div>
  <custom-element data-test="value">
    <nested>Content with {variable}</nested>
  </custom-element>
</div>`;

      const result = parser.parseAs(unusualHTML, "html") as SnippetDoc;
      expect(result.meta.trigger).toBe("unusual");
      expect(result.meta.variables.some((v) => v.name === "variable")).toBe(
        true,
      );
    });

    test("handles Markdown with complex syntax", () => {
      const complexMD = `---
trigger: "complex-md"
description: "Complex Markdown with various elements"
---
# {title}

## Features

- [ ] Task with {taskName}
- [x] Completed task

> Blockquote with {quote}

| Column | Value |
|--------|-------|
| {key}  | {val} |`;

      const result = parser.parseAs(complexMD, "md") as SnippetDoc;
      expect(result.meta.trigger).toBe("complex-md");
      expect(result.meta.variables.map((v) => v.name)).toEqual(
        expect.arrayContaining(["title", "taskName", "quote", "key", "val"]),
      );
    });

    test("handles files without frontmatter", () => {
      const plainHTML = "<div>Hello {name}!</div>";
      const result = parser.parseAs(
        plainHTML,
        "html",
        "test.html",
      ) as SnippetDoc;

      expect(result.meta.trigger).toBe("test");
      expect(result.meta.variables.some((v) => v.name === "name")).toBe(true);
    });

    test("handles very large content", () => {
      const largeContent = '---\ntrigger: "large"\n---\n' + "x".repeat(10000);
      const result = parser.parseAs(largeContent, "txt") as SnippetDoc;

      expect(result.meta.trigger).toBe("large");
      expect(result.body.length).toBe(10000);
    });
  });

  describe("Serialization Options", () => {
    test("includes timestamps when requested", () => {
      const content = readFixture("sample.txt");
      const parsed = parser.parseAs(content, "txt") as SnippetDoc;

      const serialized = parser.serialize(parsed, "txt", {
        includeTimestamps: true,
      });

      expect(serialized).toContain("createdAt:");
      expect(serialized).toContain("updatedAt:");
      expect(serialized).toContain("createdBy:");
      expect(serialized).toContain("updatedBy:");
    });

    test("pretty prints JSON when requested", () => {
      const content = readFixture("sample.json");
      const parsed = parser.parseAs(content, "json");

      const compact = parser.serialize(parsed, "json", { pretty: false });
      const pretty = parser.serialize(parsed, "json", { pretty: true });

      expect(pretty.length).toBeGreaterThan(compact.length);
      expect(pretty).toContain("\n  "); // Indentation
    });

    test("handles serialization with format conversion", () => {
      const content = readFixture("sample.txt");
      const parsed = parser.parseAs(content, "txt") as SnippetDoc;

      const htmlSerialized = parser.serialize(parsed, "html");
      expect(htmlSerialized).toContain("<!-- YAML");
      expect(htmlSerialized).toContain("contentType: html");
    });
  });

  describe.skip("Markdown Parser - Additional Tests", () => {
    it("should parse a complex markdown file with frontmatter and multiple snippets", () => {
      const markdownContent = `
---
author: Marvin Bentley
version: 1.0
---

# Snippets Collection

## ;greet
Hello, world!

### ;farewell
\`\`\`
Goodbye, cruel world!
See you tomorrow.
\`\`\`

## ;code (Code Snippet)
\`\`\`javascript
console.log("This is a test.");
\`\`\`

---

## Another Section

### ;multi-line
This is a multi-line snippet.
It spans across multiple lines.

### ;empty

### ;with-tags
- tag1
- tag2
A snippet with tags.
`;

      const result = parser.parse(markdownContent, "test.md");
      const snippets = result as SnippetDoc[];

      expect(snippets).toHaveLength(6);

      expect(snippets[0]).toMatchObject({
        meta: { trigger: ";greet" },
        body: "Hello, world!",
      });

      expect(snippets[1]).toMatchObject({
        meta: { trigger: ";farewell" },
        body: "Goodbye, cruel world!\nSee you tomorrow.",
      });

      expect(snippets[2]).toMatchObject({
        meta: { trigger: ";code" },
        body: 'console.log("This is a test.");',
      });

      expect(snippets[3]).toMatchObject({
        meta: { trigger: ";multi-line" },
        body: "This is a multi-line snippet.\nIt spans across multiple lines.",
      });

      expect(snippets[4]).toMatchObject({
        meta: { trigger: ";empty" },
        body: "",
      });

      expect(snippets[5]).toMatchObject({
        meta: { trigger: ";with-tags" },
        body: "A snippet with tags.\n- tag1\n- tag2",
      });
    });

    it("should handle markdown with no frontmatter", () => {
      const markdownContent = `
# Snippets

## ;test
This is a test snippet.
`;
      const result = parser.parse(markdownContent, "test.md");
      const snippets = result as SnippetDoc[];

      expect(snippets).toHaveLength(1);
      expect(snippets[0]).toMatchObject({
        meta: { trigger: ";test" },
        body: "This is a test snippet.",
      });
    });

    it("should handle markdown with only frontmatter", () => {
      const markdownContent = `
---
author: Test
---
`;
      const result = parser.parse(markdownContent, "test.md");
      const snippets = result as SnippetDoc[];

      expect(snippets).toHaveLength(0);
    });

    it("should handle markdown with no snippets", () => {
      const markdownContent = `
# No Snippets Here

This is just some regular markdown content.
`;
      const result = parser.parse(markdownContent, "test.md");
      const snippets = result as SnippetDoc[];

      expect(snippets).toHaveLength(0);
    });

    it("should handle an empty markdown file", () => {
      const markdownContent = "";
      const result = parser.parse(markdownContent, "test.md");
      const snippets = result as SnippetDoc[];

      expect(snippets).toHaveLength(0);
    });
  });
});
