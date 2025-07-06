/**
 * HTML Sanitization Utility
 * Prevents XSS attacks by sanitizing HTML content
 */

export function sanitizeHtml(html: string): string {
  // Handle null/undefined input gracefully
  if (html == null) {
    return "";
  }

  const doc = new DOMParser().parseFromString(html, "text/html");

  // Remove script tags
  doc.querySelectorAll("script").forEach((script) => script.remove());

  // Remove attributes that can execute code
  doc.querySelectorAll("*[on*]").forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.startsWith("on")) {
        element.removeAttribute(attr.name);
      }
    });
  });

  // You might want to extend this to allow only specific tags/attributes
  // For example, using a library like DOMPurify for more robust sanitization

  return doc.body.innerHTML;
}
