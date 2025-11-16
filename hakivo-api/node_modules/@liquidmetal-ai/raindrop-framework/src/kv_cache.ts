export interface KvCacheListKey<Metadata, Key extends string = string> {
  name: Key;
  expiration?: number;
  metadata?: Metadata;
}
export type KvCacheListResult<Metadata, Key extends string = string> =
  | {
      list_complete: false;
      keys: KvCacheListKey<Metadata, Key>[];
      cursor: string;
      cacheStatus: string | null;
    }
  | {
      list_complete: true;
      keys: KvCacheListKey<Metadata, Key>[];
      cacheStatus: string | null;
    };
export interface KvCache<Key extends string = string> {
  get(key: Key, options?: Partial<KvCacheGetOptions<undefined>>): Promise<string | null>;
  get(key: Key, type: 'text'): Promise<string | null>;
  get<ExpectedValue = unknown>(key: Key, type: 'json'): Promise<ExpectedValue | null>;
  get(key: Key, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  get(key: Key, type: 'stream'): Promise<ReadableStream | null>;
  get(key: Key, options?: KvCacheGetOptions<'text'>): Promise<string | null>;
  get<ExpectedValue = unknown>(key: Key, options?: KvCacheGetOptions<'json'>): Promise<ExpectedValue | null>;
  get(key: Key, options?: KvCacheGetOptions<'arrayBuffer'>): Promise<ArrayBuffer | null>;
  get(key: Key, options?: KvCacheGetOptions<'stream'>): Promise<ReadableStream | null>;
  list<Metadata = unknown>(options?: KvCacheListOptions): Promise<KvCacheListResult<Metadata, Key>>;
  put(
    key: Key,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: KvCachePutOptions,
  ): Promise<void>;
  getWithMetadata<Metadata = unknown>(
    key: Key,
    options?: Partial<KvCacheGetOptions<undefined>>,
  ): Promise<KvCacheGetWithMetadataResult<string, Metadata>>;
  getWithMetadata<Metadata = unknown>(key: Key, type: 'text'): Promise<KvCacheGetWithMetadataResult<string, Metadata>>;
  getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
    key: Key,
    type: 'json',
  ): Promise<KvCacheGetWithMetadataResult<ExpectedValue, Metadata>>;
  getWithMetadata<Metadata = unknown>(
    key: Key,
    type: 'arrayBuffer',
  ): Promise<KvCacheGetWithMetadataResult<ArrayBuffer, Metadata>>;
  getWithMetadata<Metadata = unknown>(
    key: Key,
    type: 'stream',
  ): Promise<KvCacheGetWithMetadataResult<ReadableStream, Metadata>>;
  getWithMetadata<Metadata = unknown>(
    key: Key,
    options: KvCacheGetOptions<'text'>,
  ): Promise<KvCacheGetWithMetadataResult<string, Metadata>>;
  getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
    key: Key,
    options: KvCacheGetOptions<'json'>,
  ): Promise<KvCacheGetWithMetadataResult<ExpectedValue, Metadata>>;
  getWithMetadata<Metadata = unknown>(
    key: Key,
    options: KvCacheGetOptions<'arrayBuffer'>,
  ): Promise<KvCacheGetWithMetadataResult<ArrayBuffer, Metadata>>;
  getWithMetadata<Metadata = unknown>(
    key: Key,
    options: KvCacheGetOptions<'stream'>,
  ): Promise<KvCacheGetWithMetadataResult<ReadableStream, Metadata>>;
  delete(key: Key): Promise<void>;

  /**
   * Clears all entries from the cache by deleting each key individually.
   *
   * Note: This operation is subject to Cloudflare Workers operation limits
   * (typically 1,000 operations per invocation). If the cache contains more
   * keys than can be deleted in a single invocation, this method will throw
   * an error indicating how many keys were deleted and how many remain.
   *
   * Callers should invoke clear() repeatedly until it succeeds without errors.
   *
   * @throws Error if operation limit is reached before all keys are deleted
   * @returns Promise resolving to result with deletion counts
   */
  clear(): Promise<KvCacheClearResult>;
}
export interface KvCacheListOptions {
  limit?: number;
  prefix?: string | null;
  cursor?: string | null;
}
export interface KvCacheGetOptions<Type> {
  type: Type;
  cacheTtl?: number;
}
export interface KvCachePutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: any | null; // eslint-disable-line @typescript-eslint/no-explicit-any
}
export interface KvCacheGetWithMetadataResult<Value, Metadata> {
  value: Value | null;
  metadata: Metadata | null;
  cacheStatus: string | null;
}

/**
 * Result of a cache clear operation
 */
export interface KvCacheClearResult {
  /** Number of keys successfully deleted */
  deleted: number;
  /** Total number of keys that existed before deletion */
  total: number;
}
