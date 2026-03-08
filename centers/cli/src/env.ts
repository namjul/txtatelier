import {
  createFormatTypeError,
  String as EvoluString,
  Mnemonic,
  object,
  optional,
  union,
} from "@evolu/common";

const LoggingValue = union("0", "1", "false", "true");

const EnvInput = object({
  TXTATELIER_DB_PATH: optional(EvoluString),
  TXTATELIER_LOGGING: optional(LoggingValue),
  TXTATELIER_MNEMONIC: optional(Mnemonic),
  TXTATELIER_RELAY_URL: optional(EvoluString),
});

const formatTypeError = createFormatTypeError();

const parseEnv = () => {
  const processEnv = process.env as Record<string, string | undefined>;
  // biome-ignore-start lint/complexity/useLiteralKeys: process.env is typed via index signature; dot access triggers TS4111.
  const mnemonicInput = processEnv["TXTATELIER_MNEMONIC"];
  const dbPathInput = processEnv["TXTATELIER_DB_PATH"];
  const loggingInput = processEnv["TXTATELIER_LOGGING"];
  const relayUrlInput = processEnv["TXTATELIER_RELAY_URL"];
  // biome-ignore-end lint/complexity/useLiteralKeys: process.env is typed via index signature; dot access triggers TS4111.
  const mnemonic =
    mnemonicInput && mnemonicInput.trim() !== "" ? mnemonicInput : undefined;

  const envInput = {
    ...(dbPathInput !== undefined ? { TXTATELIER_DB_PATH: dbPathInput } : {}),
    ...(loggingInput !== undefined ? { TXTATELIER_LOGGING: loggingInput } : {}),
    ...(mnemonic !== undefined ? { TXTATELIER_MNEMONIC: mnemonic } : {}),
    ...(relayUrlInput !== undefined
      ? { TXTATELIER_RELAY_URL: relayUrlInput }
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
    dbPath: raw.TXTATELIER_DB_PATH,
    enableLogging: raw.TXTATELIER_LOGGING
      ? raw.TXTATELIER_LOGGING === "1" || raw.TXTATELIER_LOGGING === "true"
      : false,
    mnemonic: raw.TXTATELIER_MNEMONIC,
    relayUrl: raw.TXTATELIER_RELAY_URL,
  } as const;
};

export const env = parseEnv();
