/**
 * Paste Strategies Module
 * Exports all paste strategies and utilities
 */

// Base strategy and utilities
export { BasePasteStrategy, PasteUtils } from "./base-strategy.js";
export type {
  PasteContent,
  PasteResult,
  PasteOptions,
  PasteMetadata,
} from "./base-strategy.js";

// Individual strategies
export { PlaintextPasteStrategy } from "./plaintext-strategy.js";
export { GmailPasteStrategy } from "./gmail-strategy.js";
export { GoogleDocsPasteStrategy } from "./google-docs-strategy.js";
export { FallbackPasteStrategy } from "./fallback-strategy.js";

// Paste manager
export {
  PasteManager,
  pasteManager,
  executePasteOperation,
} from "./paste-manager.js";
export type {
  PasteStrategyScore,
  PasteManagerOptions,
  PasteManagerResult,
} from "./paste-manager.js";

// Re-export target detector types for convenience
export type { TargetSurface, TargetSurfaceType } from "../target-detector.js";
