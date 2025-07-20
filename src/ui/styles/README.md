# UI Theming System

This directory contains the core styles that define the visual identity of the PuffPuffPaste Chrome Extension.

## `theme.css`

This is the single source of truth for the extension's design system. It includes:

- **CSS Custom Properties (Variables)**: A comprehensive set of variables for colors, fonts, and other core design tokens.
- **Font Imports**: Imports the "Inter" and "Fredoka" fonts from Google Fonts.

### Usage

To apply the theme to a new HTML file, link this stylesheet _before_ any component-specific stylesheets:

```html
<link rel="stylesheet" href="../ui/styles/theme.css" />
<link rel="stylesheet" href="my-component.css" />
```

In your component's CSS, use the variables defined in `:root` to ensure consistency:

```css
.my-component {
  background-color: var(--card-bg);
  font-family: var(--font-body);
  color: var(--text-dark);
}

.my-component h1 {
  font-family: var(--font-heading);
  color: var(--primary-blue);
}
```

By using these shared variables, we can ensure a consistent and easily maintainable UI across the entire extension.
