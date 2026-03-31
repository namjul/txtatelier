/**
 * When the command menu input is "?" or starts with "?", show action items
 * instead of filtering files by path.
 */
export const isCommandMenuActionMode = (inputValue: string): boolean =>
  inputValue === "?" || inputValue.startsWith("?");

/** Combobox item value for the Open Settings action (must not collide with file ids). */
export const COMMAND_MENU_OPEN_SETTINGS_VALUE = "__txtatelier_open_settings__";
