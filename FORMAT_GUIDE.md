# PuffPuffPaste Format Guide

## 📋 Overview

PuffPuffPaste supports multiple file formats for storing and organizing your text snippets. This flexible system allows you to choose the format that best suits your workflow while maintaining full compatibility across all cloud providers.

## 🚀 Supported Formats

### 1. JSON Format (Default)

The traditional format for programmatic snippet management.

**File Extension:** `.json`  
**Use Case:** API integrations, bulk imports, structured data

```json
[
  {
    "id": "greeting-1",
    "trigger": ";hello",
    "content": "Hello, how are you today?",
    "description": "Friendly greeting",
    "tags": ["greetings", "casual"],
    "createdAt": "2023-01-01T10:00:00Z",
    "updatedAt": "2023-01-01T10:00:00Z"
  },
  {
    "id": "signature-1",
    "trigger": ";sig",
    "content": "Best regards,\\nJohn Doe\\nSoftware Engineer",
    "description": "Professional email signature",
    "tags": ["email", "signature"],
    "createdAt": "2023-01-02T10:00:00Z",
    "updatedAt": "2023-01-02T10:00:00Z"
  }
]
```

### 2. Plain Text with YAML Frontmatter

Simple text files with metadata headers.

**File Extension:** `.txt`  
**Use Case:** Simple snippets, easy editing, version control

```yaml
---
id: "greeting-1"
trigger: ";hello"
description: "Friendly greeting"
tags: ["greetings", "casual"]
createdAt: "2023-01-01T10:00:00Z"
updatedAt: "2023-01-01T10:00:00Z"
---
Hello, how are you today?
```

```yaml
---
id: "signature-1"
trigger: ";sig"
description: "Professional email signature"
tags: ["email", "signature"]
createdAt: "2023-01-02T10:00:00Z"
updatedAt: "2023-01-02T10:00:00Z"
---
Best regards,
John Doe
Software Engineer
```

### 3. Markdown Format

Rich text with formatting support and YAML frontmatter.

**File Extension:** `.md`  
**Use Case:** Documentation, formatted content, technical writing

```yaml
---
id: "code-review-1"
trigger: ";review"
description: "Code review template"
tags: ["development", "review"]
variables: ["author", "feature"]
createdAt: "2023-01-03T10:00:00Z"
updatedAt: "2023-01-03T10:00:00Z"
---
## Code Review for {feature}

**Author:** {author}
**Reviewer:** [Your Name]
**Date:** $(date)

### Summary
Brief description of changes...

### Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included
- [ ] Documentation is updated

### Comments
Please provide specific feedback below:
```

### 4. HTML Format

Rich formatted content with YAML frontmatter.

**File Extension:** `.html`  
**Use Case:** Email templates, rich content, web snippets

```yaml
---
id: "email-template-1"
trigger: ";meeting"
description: "Meeting invitation template"
tags: ["email", "meetings"]
variables: ["attendee", "date", "time"]
contentType: "html"
createdAt: "2023-01-04T10:00:00Z"
updatedAt: "2023-01-04T10:00:00Z"
---
<div style="font-family: Arial, sans-serif; color: #333;">
  <h2 style="color: #0066cc;">Meeting Invitation</h2>

  <p>Dear {attendee},</p>

  <p>You're invited to attend our meeting:</p>

  <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #0066cc;">
    <strong>Date:</strong> {date}<br>
    <strong>Time:</strong> {time}<br>
    <strong>Location:</strong> Conference Room A
  </div>

  <p>Please confirm your attendance.</p>

  <p>Best regards,<br>
  <em>The Team</em></p>
</div>
```

### 5. LaTeX Format

Scientific and mathematical content with YAML frontmatter.

**File Extension:** `.tex`  
**Use Case:** Academic writing, mathematical formulas, scientific documents

```yaml
---
id: "theorem-1"
trigger: ";pythagorean"
description: "Pythagorean theorem"
tags: ["math", "geometry", "theorem"]
variables: ["a", "b", "c"]
createdAt: "2023-01-05T10:00:00Z"
updatedAt: "2023-01-05T10:00:00Z"
---
\\begin{theorem}[Pythagorean Theorem]
In a right triangle with legs of length $\\{a\\}$ and $\\{b\\}$, and hypotenuse of length $\\{c\\}$:

$$\\{a\\}^2 + \\{b\\}^2 = \\{c\\}^2$$

\\end{theorem}

\\begin{proof}
The proof follows from the geometric construction...
\\end{proof}
```

## 🔄 Format Detection

PuffPuffPaste automatically detects the format based on:

1. **File Extension:** `.json`, `.txt`, `.md`, `.html`, `.tex`
2. **Content Analysis:** Structure and syntax patterns
3. **YAML Frontmatter:** Presence of metadata headers

### Detection Algorithm

```
Input: fileName, fileContent
Output: "json" | "txt" | "md" | "html" | "tex"

If fileName.endsWith('.json') OR content.startsWith('{') → json
Else if fileName.endsWith('.tex') OR content.includes('\\begin{') → tex
Else if fileName.endsWith('.html') OR content.includes('<html|<div|<p') → html
Else if fileName.endsWith('.md') OR content.includes('# ') → md
Else → txt (default)
```

## 📝 YAML Frontmatter Schema

All non-JSON formats use YAML frontmatter for metadata:

### Required Fields

```yaml
---
id: "unique-identifier" # Required: Unique snippet ID
trigger: ";shortcut" # Required: Trigger text
---
```

### Optional Fields

```yaml
---
description: "Brief description" # Optional: Human-readable description
tags: ["tag1", "tag2"] # Optional: Categorization tags
variables: ["var1", "var2"] # Optional: Placeholder variables
contentType: "html" # Optional: Content type hint
createdAt: "2023-01-01T10:00:00Z" # Optional: Creation timestamp
updatedAt: "2023-01-01T10:00:00Z" # Optional: Last update timestamp
createdBy: "user@example.com" # Optional: Creator identification
updatedBy: "user@example.com" # Optional: Last editor identification
---
```

## 🔀 Variable Placeholders

All formats support dynamic placeholders:

### Syntax

- **Simple:** `{variableName}`
- **With default:** `{variableName:defaultValue}`
- **Date/time:** `$(date)`, `$(time)`, `$(datetime)`

### Examples

```yaml
---
trigger: ";email"
variables: ["name", "company"]
---
Dear {name:Sir/Madam},

Thank you for your interest in {company:Our Company}.
We received your inquiry on $(date).

Best regards,
Customer Service Team
```

## 🌐 Cloud Storage Integration

### File Organization

```
📁 My Snippets/
├── 📄 greetings.json          # JSON format
├── 📄 signatures.txt          # Plain text
├── 📄 templates.md            # Markdown
├── 📄 emails.html             # HTML
└── 📄 formulas.tex            # LaTeX
```

### Multi-Format Discovery

PuffPuffPaste automatically discovers and processes all supported formats in your cloud folders:

1. **Scans** for files with supported extensions
2. **Detects** format based on content and extension
3. **Parses** metadata and content appropriately
4. **Merges** all snippets into unified library

## 🛠️ Format Conversion

### Automatic Conversion

- **Upload:** Content is automatically formatted for target format
- **Download:** Parsed into standardized snippet objects
- **Sync:** Maintains original format during cloud operations

### Manual Conversion

```bash
# Convert JSON to Markdown
npm run convert -- snippets.json snippets.md

# Convert Markdown to HTML
npm run convert -- templates.md templates.html
```

## 📊 Format Recommendations

| Use Case                 | Recommended Format | Why                                           |
| ------------------------ | ------------------ | --------------------------------------------- |
| **Simple text snippets** | `.txt`             | Easy to edit, minimal overhead                |
| **Team collaboration**   | `.md`              | Good balance of features and readability      |
| **Email templates**      | `.html`            | Rich formatting support                       |
| **API/programmatic**     | `.json`            | Structured data, easy parsing                 |
| **Academic/scientific**  | `.tex`             | LaTeX formula support                         |
| **Documentation**        | `.md`              | Markdown formatting, version control friendly |

## 🔧 Advanced Features

### Format-Specific Processing

- **HTML:** Automatic sanitization and XSS protection
- **LaTeX:** Math formula rendering support
- **Markdown:** CommonMark compliance with extensions
- **JSON:** Schema validation and error handling

### Backward Compatibility

- All formats maintain compatibility with existing snippets
- Legacy JSON files continue to work without conversion
- Gradual migration supported across all formats

### Performance Optimization

- **Lazy Loading:** Large files loaded on demand
- **Caching:** Parsed content cached for fast access
- **Incremental Sync:** Only changed files re-processed

## 🚨 Best Practices

### File Organization

```
📁 Personal/
├── 📄 daily-snippets.txt      # Simple, frequently used
├── 📄 email-templates.html    # Rich formatting
└── 📄 code-templates.md       # Technical content

📁 Team/
├── 📄 shared-responses.md     # Collaborative editing
├── 📄 brand-emails.html       # Marketing content
└── 📄 api-examples.json       # Structured data
```

### Security Considerations

- **Sensitive Data:** Use encrypted cloud storage
- **HTML Content:** Automatic XSS protection applied
- **File Validation:** Content sanitized on import

### Version Control Integration

```bash
# Git-friendly formats
git add snippets.txt snippets.md

# Track changes easily
git diff snippets.md
```

## 🆘 Troubleshooting

### Common Issues

**Format not detected correctly:**

```
Solution: Check file extension and content structure
Ensure YAML frontmatter is properly formatted
```

**Sync failures:**

```
Solution: Validate YAML syntax
Check for special characters in metadata
```

**Variables not expanding:**

```
Solution: Verify variable names in frontmatter
Check placeholder syntax: {variableName}
```

### Validation Commands

```bash
# Validate format structure
npm run validate:snippets

# Check YAML syntax
npm run validate:yaml snippets.md

# Test format detection
npm run detect:format myfile.txt
```

## 📖 Additional Resources

- **[README.md](./README.md)** - General project documentation
- **[API Documentation](./docs/api/)** - Developer reference
- **[Examples Repository](./examples/)** - Format examples and templates
- **[Migration Guide](./docs/migration.md)** - Converting between formats

---

_For questions or support, please visit our [GitHub Issues](https://github.com/your-repo/issues) page._
