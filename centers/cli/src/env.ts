import {
  createFormatTypeError,
  String as EvoluString,
  object,
  optional,
  union,
} from "@evolu/common";

export const LogLevel = union("DEBUG", "INFO", "ERROR");
export type LogLevel = typeof LogLevel.Type;

const EnvInput = object({
  TXTATELIER_DB_PATH: optional(EvoluString),
  TXTATELIER_LOG_LEVEL: optional(LogLevel),
  TXTATELIER_RELAY_URL: optional(EvoluString),
  TXTATELIER_WATCH_DIR: optional(EvoluString),
});

const formatTypeError = createFormatTypeError();

const parseEnv = () => {
  const processEnv = process.env as Record<string, string | undefined>;
  // biome-ignore-start lint/complexity/useLiteralKeys: process.env is typed via index signature; dot access triggers TS4111.
  const dbPathInput = processEnv["TXTATELIER_DB_PATH"];
  const logLevelInput = processEnv["TXTATELIER_LOG_LEVEL"];
  const relayUrlInput = processEnv["TXTATELIER_RELAY_URL"];
  const watchDirInput = processEnv["TXTATELIER_WATCH_DIR"];
  // biome-ignore-end lint/complexity/useLiteralKeys: process.env is typed via index signature; dot access triggers TS4111.

  const envInput = {
    ...(dbPathInput !== undefined ? { TXTATELIER_DB_PATH: dbPathInput } : {}),
    ...(logLevelInput !== undefined
      ? { TXTATELIER_LOG_LEVEL: logLevelInput.toUpperCase() }
      : {}),
    ...(relayUrlInput !== undefined
      ? { TXTATELIER_RELAY_URL: relayUrlInput }
      : {}),
    ...(watchDirInput !== undefined
      ? { TXTATELIER_WATCH_DIR: watchDirInput }
      : {}),
  };

  const parsed = EnvInput.fromUnknown(envInput);

  if (!parsed.ok) {
    const details = formatTypeError(parsed.error);
    console.error(
      `Invalid TXTATELIER_* environment configuration:\n${details}`,
    );
    process.exit(1);
  }

  const raw = parsed.value;

  return {
    dbPath: raw.TXTATELIER_DB_PATH,
    logLevel: raw.TXTATELIER_LOG_LEVEL ?? "ERROR",
    relayUrl: raw.TXTATELIER_RELAY_URL,
    watchDir: raw.TXTATELIER_WATCH_DIR,
  } as const;
};

export const env = parseEnv();
