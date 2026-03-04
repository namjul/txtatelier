import { homedir } from "node:os";
import { join } from "node:path";
import {
  createFormatTypeError,
  String as EvoluString,
  Mnemonic,
  object,
  optional,
  union,
} from "@evolu/common";

const defaultDbPath = join(homedir(), ".txtatelier", "txtatelier.db");
const defaultWatchDir = join(homedir(), ".txtatelier", "watched");

const LoggingValue = union("0", "1", "false", "true");

const EnvInput = object({
  TXTATELIER_DB_PATH: optional(EvoluString),
  TXTATELIER_LOGGING: optional(LoggingValue),
  TXTATELIER_MNEMONIC: optional(Mnemonic),
  TXTATELIER_WATCH_DIR: optional(EvoluString),
});

const formatTypeError = createFormatTypeError();

const parseEnv = () => {
  const processEnv = process.env as Record<string, string | undefined>;
  const mnemonicInput = processEnv["TXTATELIER_MNEMONIC"];
  const mnemonic =
    mnemonicInput && mnemonicInput.trim() !== "" ? mnemonicInput : undefined;

  const envInput = {
    ...(processEnv["TXTATELIER_DB_PATH"] !== undefined
      ? { TXTATELIER_DB_PATH: processEnv["TXTATELIER_DB_PATH"] }
      : {}),
    ...(processEnv["TXTATELIER_LOGGING"] !== undefined
      ? { TXTATELIER_LOGGING: processEnv["TXTATELIER_LOGGING"] }
      : {}),
    ...(mnemonic !== undefined ? { TXTATELIER_MNEMONIC: mnemonic } : {}),
    ...(processEnv["TXTATELIER_WATCH_DIR"] !== undefined
      ? { TXTATELIER_WATCH_DIR: processEnv["TXTATELIER_WATCH_DIR"] }
      : {}),
  };

  const parsed = EnvInput.fromUnknown(envInput);

  if (!parsed.ok) {
    const details = formatTypeError(parsed.error);
    throw new Error(
      `Invalid TXTATELIER_* environment configuration:\n${details}`,
    );
  }

  const raw = parsed.value;

  return {
    dbPath: raw.TXTATELIER_DB_PATH ?? defaultDbPath,
    enableLogging: raw.TXTATELIER_LOGGING
      ? raw.TXTATELIER_LOGGING === "1" || raw.TXTATELIER_LOGGING === "true"
      : true,
    mnemonic: raw.TXTATELIER_MNEMONIC,
    watchDir: raw.TXTATELIER_WATCH_DIR ?? defaultWatchDir,
  } as const;
};

export const env = parseEnv();
