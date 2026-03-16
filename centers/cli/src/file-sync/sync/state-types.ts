// State structures representing filesystem and Evolu state
// Pure data - readonly interfaces with no methods

/**
 * Complete snapshot of file state across all sources
 */
export interface FileState {
  readonly path: string;
  readonly diskHash: string | null;
  readonly diskContent: string | null;
  readonly diskExists: boolean;
  readonly evolHash: string | null;
  readonly evolContent: string | null;
  readonly evolId: string | null;
  readonly evolIsDeleted: boolean;
  readonly lastAppliedHash: string | null;
  readonly ownerId: string;
}

/**
 * State needed for change capture planning (filesystem → Evolu)
 */
export interface ChangeCaptureState {
  readonly path: string;
  readonly diskHash: string | null;
  readonly diskContent: string | null;
  readonly evolHash: string | null;
  readonly evolId: string | null;
}

/**
 * State needed for materialization planning (Evolu → filesystem)
 */
export interface MaterializationState {
  readonly path: string;
  readonly diskHash: string | null;
  readonly evolHash: string | null;
  readonly evolContent: string | null;
  readonly lastAppliedHash: string | null;
  readonly ownerId: string;
}
