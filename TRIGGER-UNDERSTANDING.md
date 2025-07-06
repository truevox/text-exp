# 🚨 CRITICAL TRIGGER UNDERSTANDING - NEVER FORGET!

**TRIGGERS ARE VERBATIM FROM SNIPPET FILES - ANY STRING CAN BE A TRIGGER!**

- If snippet says `trigger: "email"` → user types `"email"` to trigger it
- If snippet says `trigger: ";goat"` → user types `";goat"` to trigger it
- If snippet says `trigger: "pony:"` → user types `"pony:"` to trigger it
- If snippet says `trigger: "@@@@"` → user types `"@@@@"` to trigger it

**NO ASSUMPTIONS ABOUT PREFIXES OR SPECIAL CHARACTERS!** The trigger is exactly what's stored in the snippet file, character for character. ANY combination of characters can be a trigger.

This means the TriggerDetector must be designed to match ANY string pattern, not assume specific prefixes like `;`.
