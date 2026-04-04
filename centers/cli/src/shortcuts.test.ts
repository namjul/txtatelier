import type { Interface as ReadlineInterface } from "node:readline";
import { describe, expect, test, vi } from "vitest";
import type { FileSyncSession } from "./file-sync/index.js";
import type { Logger } from "./logger.js";
import { bindShortcuts, computeStdinInteractive } from "./shortcuts.js";

const flushMicrotasks = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
};

describe("computeStdinInteractive", () => {
  test("returns false when stdin is not a TTY", () => {
    const orig = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: false,
    });
    expect(computeStdinInteractive()).toBe(false);
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: orig,
    });
  });

  test("returns false when CI is true", () => {
    const origTTY = process.stdin.isTTY;
    const origCI = process.env["CI"];
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });
    process.env["CI"] = "true";
    expect(computeStdinInteractive()).toBe(false);
    process.env["CI"] = origCI;
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: origTTY,
    });
  });
});

describe("bindShortcuts", () => {
  test("logs non-interactive hint when isTTY is false", () => {
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const session = {} as unknown as FileSyncSession;

    bindShortcuts({
      session,
      logger,
      isTTY: false,
      options: { print: true },
      readline: null,
    });

    expect(logger.info).toHaveBeenCalledWith(
      "Running non-interactive (shortcuts disabled)",
    );
  });

  test("dispatches h to print help", async () => {
    const info = vi.fn();
    const logger: Logger = {
      debug: vi.fn(),
      info,
      warn: vi.fn(),
      error: vi.fn(),
    };
    let lineHandler: ((line: string) => void) | undefined;
    const prompt = vi.fn();
    const rl = {
      on: (event: string, fn: (line: string) => void) => {
        if (event === "line") {
          lineHandler = fn;
        }
      },
      question: (_q: string, cb: (a: string) => void) => {
        cb("");
      },
      pause: vi.fn(),
      resume: vi.fn(),
      prompt,
      close: vi.fn(),
    } as unknown as ReadlineInterface;

    const session = {
      showStatus: vi.fn().mockResolvedValue(undefined),
      showMnemonic: vi.fn().mockResolvedValue(undefined),
      restoreMnemonic: vi.fn().mockResolvedValue(undefined),
      resetOwner: vi.fn().mockResolvedValue(undefined),
      clearConsole: vi.fn(),
      quit: vi.fn().mockResolvedValue(undefined),
    } as unknown as FileSyncSession;

    bindShortcuts({
      session,
      logger,
      isTTY: true,
      options: { print: false },
      readline: rl,
    });

    expect(lineHandler).toBeDefined();
    lineHandler!("h");
    await flushMicrotasks();

    expect(info).toHaveBeenCalledWith(
      "  Shortcuts (type letter + Enter)",
    );
  });

  test("dispatches c to clear console", async () => {
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    let lineHandler: ((line: string) => void) | undefined;
    const clearConsole = vi.fn();
    const rl = {
      on: (event: string, fn: (line: string) => void) => {
        if (event === "line") {
          lineHandler = fn;
        }
      },
      question: (_q: string, cb: (a: string) => void) => {
        cb("");
      },
      pause: vi.fn(),
      resume: vi.fn(),
      prompt: vi.fn(),
      close: vi.fn(),
    } as unknown as ReadlineInterface;

    const session = {
      showStatus: vi.fn().mockResolvedValue(undefined),
      showMnemonic: vi.fn().mockResolvedValue(undefined),
      restoreMnemonic: vi.fn().mockResolvedValue(undefined),
      resetOwner: vi.fn().mockResolvedValue(undefined),
      clearConsole,
      quit: vi.fn().mockResolvedValue(undefined),
    } as unknown as FileSyncSession;

    bindShortcuts({
      session,
      logger,
      isTTY: true,
      options: { print: false },
      readline: rl,
    });

    lineHandler!("c");
    await flushMicrotasks();

    expect(clearConsole).toHaveBeenCalledTimes(1);
  });
});
