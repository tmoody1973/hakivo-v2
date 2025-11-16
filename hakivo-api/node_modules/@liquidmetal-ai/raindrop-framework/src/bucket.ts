/** Error type for bucket operations */
export interface BucketError extends Error {
  /** Name of the error */
  readonly name: string;
  /** Error code */
  readonly code: number;
  /** Error message */
  readonly message: string;
  /** Action that caused the error */
  readonly action: string;
  /** Error stack trace */
  readonly stack: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Options for listing bucket contents */
export interface BucketListOptions {
  /** Maximum number of items to return */
  limit?: number;
  /** Filter results to keys that begin with this prefix */
  prefix?: string;
  /** Continuation token for paginated results */
  cursor?: string;
  /** Character to group common prefixes by */
  delimiter?: string;
  /** Return objects lexicographically after this key */
  startAfter?: string;
}
/** Interface for interacting with a storage bucket */
export interface Bucket {
  /**
   * Retrieves object metadata without downloading the object
   * @param key Object key
   * @returns Promise resolving to object metadata or null if not found
   */
  head(key: string): Promise<BucketObject | null>;

  // /**
  //  * Retrieves an object with conditional options
  //  * @param key Object key
  //  * @param options Get options with conditional requirements
  //  * @returns Promise resolving to object data or null if conditions not met
  //  */
  // get(
  //   key: string,
  //   options: BucketGetOptions & {
  //     onlyIf: BucketConditional | Headers;
  //   },
  // ): Promise<BucketObjectBody | BucketObject | null>;

  /**
   * Retrieves an object
   * @param key Object key
   * @param options Optional get options
   * @returns Promise resolving to object data or null if not found
   */
  get(key: string, options?: BucketGetOptions): Promise<BucketObjectBody | null>;

  // /**
  //  * Stores an object with conditional options
  //  * @param key Object key
  //  * @param value Object data
  //  * @param options Put options with conditional requirements
  //  * @returns Promise resolving to object metadata or null if conditions not met
  //  */
  // put(
  //   key: string,
  //   value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
  //   options?: BucketPutOptions & {
  //     onlyIf: BucketConditional | Headers;
  //   },
  // ): Promise<BucketObject | null>;

  /**
   * Stores an object
   * @param key Object key
   * @param value Object data
   * @param options Optional put options
   * @returns Promise resolving to object metadata
   */
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: BucketPutOptions,
  ): Promise<BucketObject>;

  // /**
  //  * Initiates a multipart upload
  //  * @param key Object key
  //  * @param options Optional multipart upload options
  //  * @returns Promise resolving to multipart upload handle
  //  */
  // createMultipartUpload(key: string, options?: BucketMultipartOptions): Promise<BucketMultipartUpload>;

  // /**
  //  * Resumes an in-progress multipart upload
  //  * @param key Object key
  //  * @param uploadId Multipart upload ID
  //  * @returns Multipart upload handle
  //  */
  // resumeMultipartUpload(key: string, uploadId: string): BucketMultipartUpload;

  /**
   * Deletes one or more objects
   * @param keys Single key or array of keys to delete
   * @returns Promise that resolves when deletion is complete
   */
  delete(keys: string | string[]): Promise<void>;

  /**
   * Lists objects in the bucket
   * @param options Optional listing options
   * @returns Promise resolving to list of objects
   */
  list(options?: BucketListOptions): Promise<BucketObjects>;
}
export interface BucketMultipartUpload {
  readonly key: string;
  readonly uploadId: string;
  uploadPart(
    partNumber: number,
    value: ReadableStream | (ArrayBuffer | ArrayBufferView) | string | Blob,
  ): Promise<BucketUploadedPart>;
  abort(): Promise<void>;
  complete(uploadedParts: BucketUploadedPart[]): Promise<BucketObject>;
}
export interface BucketUploadedPart {
  partNumber: number;
  etag: string;
}
export interface BucketObject {
  readonly key: string;
  readonly version: string;
  readonly size: number;
  readonly etag: string;
  readonly httpEtag: string;
  readonly checksums: BucketChecksums;
  readonly uploaded: Date;
  readonly httpMetadata?: BucketHTTPMetadata;
  readonly customMetadata?: Record<string, string>;
  readonly range?: BucketRange;
  readonly storageClass: string;
  writeHttpMetadata(headers: Headers): void;
}
export interface BucketObjectBody extends BucketObject {
  get body(): ReadableStream;
  get bodyUsed(): boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}
export type BucketRange =
  | {
    offset: number;
    length?: number;
  }
  | {
    offset?: number;
    length: number;
  }
  | {
    suffix: number;
  };
// export interface BucketConditional {
//   etagMatches?: string;
//   etagDoesNotMatch?: string;
//   uploadedBefore?: Date;
//   uploadedAfter?: Date;
//   secondsGranularity?: boolean;
// }
export interface BucketGetOptions {
  // onlyIf?: BucketConditional | Headers;
  range?: BucketRange | Headers;
}
export interface BucketPutOptions {
  // onlyIf?: BucketConditional | Headers;
  httpMetadata?: BucketHTTPMetadata | Headers;
  customMetadata?: Record<string, string>;
  md5?: ArrayBuffer | string;
  sha1?: ArrayBuffer | string;
  sha256?: ArrayBuffer | string;
  sha384?: ArrayBuffer | string;
  sha512?: ArrayBuffer | string;
  storageClass?: string;
}
export interface BucketMultipartOptions {
  httpMetadata?: BucketHTTPMetadata | Headers;
  customMetadata?: Record<string, string>;
  storageClass?: string;
}
export interface BucketChecksums {
  readonly md5?: ArrayBuffer;
  readonly sha1?: ArrayBuffer;
  readonly sha256?: ArrayBuffer;
  readonly sha384?: ArrayBuffer;
  readonly sha512?: ArrayBuffer;
  toJSON(): BucketStringChecksums;
}
export interface BucketStringChecksums {
  md5?: string;
  sha1?: string;
  sha256?: string;
  sha384?: string;
  sha512?: string;
}
export interface BucketHTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}
export type BucketObjects = {
  objects: BucketObject[];
  delimitedPrefixes: string[];
} & (
    | {
      truncated: true;
      cursor: string;
    }
    | {
      truncated: false;
    }
  );
export interface BucketEventNotification {
  action: string;
  bucket: string;
  moduleId?: string;
  object: {
    key: string;
    size?: number;
    eTag?: string;
  };
  eventTime: string;
}
