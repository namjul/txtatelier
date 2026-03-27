import {
  createFormatTypeError,
  String as EvoluString,
  object,
  optional,
} from "@evolu/common";

const EnvInput = object({
  TXTATELIER_BASE_PATH: optional(EvoluString),
});

const formatTypeError = createFormatTypeError();

const parseEnv = () => {
  // biome-ignore lint/complexity/useLiteralKeys: process.env is typed via index signature; dot access triggers TS4111.
  const basePath = import.meta.env['VITE_TXTATELIER_BASE_PATH']

  console.log("basePath", basePath);

  const envInput = {
    ...(basePath !== undefined ? { TXTATELIER_BASE_PATH: basePath } : {}),
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
    basePath: raw.TXTATELIER_BASE_PATH,
  } as const;
};

export const env = parseEnv();
