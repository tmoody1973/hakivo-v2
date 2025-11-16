import { Stub } from './shared.js';

/**
 * Represents the state interface for an actor instance
 */
export interface ActorState {
  /**
   * Registers a promise that must complete before the actor exits
   * @param promise - The promise to wait for
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waitUntil(promise: Promise<any>): void;

  /**
   * Blocks the actor's concurrency while executing the given function
   * This is useful in constructors to initialize the object from storage.
   * @param fn - The function to execute
   */
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;

  /**
   * The unique identifier for this actor instance
   */
  readonly id: ActorId;

  /**
   * Interface for accessing the actor's persistent storage
   */
  readonly storage: ActorStorage;
}

/**
 * Represents the unique identifier for an actor instance
 */
export interface ActorId {
  /**
   * Converts the actor ID to its string representation
   * @returns The string representation of the actor ID
   */
  toString(): string;

  /**
   * Checks if this actor ID equals another actor ID
   * @param other - The other actor ID to compare against
   * @returns True if the IDs are equal, false otherwise
   */
  equals(other: ActorId): boolean;

  /**
   * Optional name associated with this actor ID
   */
  readonly name?: string;
}

/**
 * Interface for interacting with persistent actor storage
 */
export interface ActorStorage {
  /**
   * Retrieves a value from storage by key
   * @param key - The key to look up
   * @returns The stored value, or undefined if not found
   */
  get<T = unknown>(key: string): Promise<T | undefined>;

  /**
   * Retrieves multiple values from storage by keys
   * @param keys - Array of keys to look up
   * @returns Map of keys to their stored values
   */
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;

  /**
   * Lists values in storage matching the given options
   * @param options - Query options for listing values
   * @param options.start - Start key (inclusive)
   * @param options.startAfter - Start key (exclusive)
   * @param options.end - End key (exclusive)
   * @param options.prefix - Key prefix to match
   * @param options.reverse - Whether to list in reverse order
   * @param options.limit - Maximum number of entries to return
   * @returns Map of matching keys to their stored values
   */
  list<T = unknown>(options?: {
    start?: string;
    startAfter?: string;
    end?: string;
    prefix?: string;
    reverse?: boolean;
    limit?: number;
  }): Promise<Map<string, T>>;

  /**
   * Stores a value in storage
   * @param key - The key to store under
   * @param value - The value to store
   */
  put<T>(key: string, value: T): Promise<void>;

  /**
   * Stores multiple values in storage
   * @param entries - Record of keys to values to store
   */
  put<T>(entries: Record<string, T>): Promise<void>;

  /**
   * Deletes a value from storage
   * @param key - The key to delete
   * @returns True if a value was deleted, false if not found
   */
  delete(key: string): Promise<boolean>;

  /**
   * Deletes multiple values from storage
   * @param keys - Array of keys to delete
   * @returns Number of values that were deleted
   */
  delete(keys: string[]): Promise<number>;

  /**
   * Deletes all values in storage, allowing the actor to be reaped.
   * Note that if this fails it should just be re-invoked until it succeeds.
   */
  deleteAll(): Promise<void>;

  /**
   * Gets the current alarm time if set
   * @returns The scheduled alarm time as a Unix timestamp, or null if no alarm is set
   */
  getAlarm(): Promise<number | null>;

  /**
   * Sets an alarm to wake the actor at a specific time
   * @param scheduledTime - When to wake the actor (as Unix timestamp or Date)
   */
  setAlarm(scheduledTime: number | Date): Promise<void>;

  /**
   * Deletes any currently set alarm
   */
  deleteAlarm(): Promise<void>;
}

/**
 * Abstract base class for implementing stateful actors
 * @template Env - The environment type containing runtime specific bindings
 */
export abstract class Actor<Env> {
  state: ActorState;
  env: Env;

  constructor(state: ActorState, env: Env) {
    this.state = state;
    this.env = env;
  }
}

/**
 * ActorStub represents a client for making RPC calls to an actor instance
 * @template T - The actor class type
 */
export type ActorStub<T> = Stub<T> & {
  /**
   * The unique identifier of the target actor instance
   */
  readonly id: ActorId;

  /**
   * Optional name of the target actor instance
   */
  readonly name?: string;
};

/**
 * ActorNamespace provides factory methods for working with actor instances
 * @template T - The actor class type
 */
export type ActorNamespace<T extends Actor<unknown>> = {
  /**
   * Gets a deterministic actor ID from a string name
   * @param name - The name to derive the ID from
   * @returns The actor ID for the given name
   */
  idFromName(name: string): ActorId;

  /**
   * Gets or creates an actor instance by ID
   * @param id - The ID of the actor to get/create
   * @returns A stub for making RPC calls to the actor
   */
  get(id: ActorId, options?: ActorGetOptions): ActorStub<T>;

  /**
   * Gets an actor namespace within a specific jurisdiction
   * @param jurisdiction - The jurisdiction to scope to
   * @returns A namespace for creating/getting actors within the jurisdiction
   */
  jurisdiction(jurisdiction: ActorJurisdiction): ActorNamespace<T>;
};

export type ActorGetOptions = {
  locationHint?: ActorLocationHint;
};

export type ActorLocationHint = 'wnam' | 'enam' | 'sam' | 'weur' | 'eeur' | 'apac' | 'oc' | 'afr' | 'me';

/**
 * Represents the jurisdiction of a durable object
 * Can be one of "eu" or "fedramp"
 */
export type ActorJurisdiction = 'eu' | 'fedramp';

/**
 * Options for creating a new unique actor ID
 */
export interface ActorNamespaceNewUniqueIdOptions {
  jurisdiction?: ActorJurisdiction;
}
