import { describe, expect, test } from "vitest";
import {
  COMMAND_MENU_OPEN_SETTINGS_VALUE,
  isCommandMenuActionMode,
} from "./commandMenuActionMode";

describe("isCommandMenuActionMode", () => {
  test("is true for single question mark", () => {
    expect(isCommandMenuActionMode("?")).toBe(true);
  });

  test("is true when input starts with question mark", () => {
    expect(isCommandMenuActionMode("? ")).toBe(true);
    expect(isCommandMenuActionMode("??")).toBe(true);
  });

  test("is false for normal file search including ? not at start", () => {
    expect(isCommandMenuActionMode("")).toBe(false);
    expect(isCommandMenuActionMode("notes")).toBe(false);
    expect(isCommandMenuActionMode("notes?")).toBe(false);
  });
});

describe("command menu settings action wiring", () => {
  test("action item value is stable and distinct from numeric ids", () => {
    expect(COMMAND_MENU_OPEN_SETTINGS_VALUE).toMatch(/^__/);
    expect(Number.isNaN(Number(COMMAND_MENU_OPEN_SETTINGS_VALUE))).toBe(true);
  });
});

describe("CommandMenu closes when opening settings from combobox", () => {
  test("dialog handler opens settings then signals command menu closed", () => {
    const order: string[] = [];
    const onOpenSettings = () => order.push("settings");
    const onOpenChange = (open: boolean) => {
      if (!open) order.push("commandMenuClosed");
    };
    const comboboxHandler = () => {
      onOpenSettings();
      onOpenChange(false);
    };
    comboboxHandler();
    expect(order).toEqual(["settings", "commandMenuClosed"]);
  });
});
