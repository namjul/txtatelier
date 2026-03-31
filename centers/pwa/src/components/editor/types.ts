export type StatusTone = "idle" | "ok" | "error";

export interface StatusState {
  readonly message: string;
  readonly tone: StatusTone;
  readonly lastAction: string | null;
}

export interface StatusOps {
  readonly setOk: (message: string) => void;
  readonly setError: (message: string) => void;
  readonly setIdle: (message: string) => void;
  readonly setLastAction: (action: string) => void;
}

export type ConflictStrategy = "local" | "remote";

export type AutoSaveUiState = "idle" | "dirty" | "saving" | "saved" | "error";
