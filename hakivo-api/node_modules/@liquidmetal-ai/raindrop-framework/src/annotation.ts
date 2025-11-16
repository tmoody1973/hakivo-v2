import { BucketListOptions, BucketObject, BucketObjectBody, BucketObjects, BucketPutOptions } from './bucket.js';

/**
 * Interface for annotation bucket operations
 * Provides MRN-aware storage and retrieval of application metadata
 */
export interface Annotation<T> {
  /**
   * Retrieves an annotation by MRN
   * @param mrn The MRN object identifying the annotation
   * @returns Promise resolving to annotation data or null if not found
   */
  get(mrn: T): Promise<BucketObjectBody | null>;

  /**
   * Stores an annotation with automatic revision management
   * @param mrn The MRN object identifying the annotation (must not include revision)
   * @param data The annotation data to store
   * @returns Promise resolving to stored object metadata
   * @throws Error if MRN already contains a revision
   */
  put(
    mrn: T,
    data: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: BucketPutOptions,
  ): Promise<BucketObject>;

  /**
   * Lists annotations matching the provided criteria
   * @param options Optional list options including prefix filtering
   * @returns Promise resolving to list of matching annotations
   */
  list(options?: BucketListOptions): Promise<BucketObjects>;
}
