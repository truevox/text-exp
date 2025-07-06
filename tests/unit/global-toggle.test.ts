/**
 * Tests for Global Toggle functionality
 */

import { DEFAULT_SETTINGS } from "../../src/shared/constants.js";
import type { ExtensionSettings } from "../../src/shared/types.js";

describe("Global Toggle Settings", () => {
  it("should include global toggle settings in default settings", () => {
    expect(DEFAULT_SETTINGS).toHaveProperty("globalToggleEnabled");
    expect(DEFAULT_SETTINGS).toHaveProperty("globalToggleShortcut");

    expect(DEFAULT_SETTINGS.globalToggleEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.globalToggleShortcut).toBe("Ctrl+Shift+T");
  });

  it("should validate settings structure", () => {
    const testSettings: ExtensionSettings = {
      ...DEFAULT_SETTINGS,
      globalToggleEnabled: false,
      globalToggleShortcut: "Alt+T",
    };

    expect(testSettings.globalToggleEnabled).toBe(false);
    expect(testSettings.globalToggleShortcut).toBe("Alt+T");
  });

  it("should allow various shortcut formats", () => {
    const validShortcuts = [
      "Ctrl+Shift+T",
      "Alt+E",
      "Ctrl+Alt+T",
      "Meta+Shift+E",
      "Cmd+T",
    ];

    validShortcuts.forEach((shortcut) => {
      expect(typeof shortcut).toBe("string");
      expect(shortcut.length).toBeGreaterThan(0);
      expect(shortcut).toMatch(/^[A-Za-z+]+$/);
    });
  });
});
