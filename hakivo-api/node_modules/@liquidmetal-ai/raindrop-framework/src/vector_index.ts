export type VectorIndexVectorMetadataValue = string | number | boolean | string[];
export type VectorIndexVectorMetadata = VectorIndexVectorMetadataValue | Record<string, VectorIndexVectorMetadataValue>;
export type VectorFloatArray = Float32Array | Float64Array;
export interface VectorIndexError {
  code?: number;
  error: string;
}
export type VectorIndexVectorMetadataFilterOp = '$eq' | '$ne';
export type VectorIndexVectorMetadataFilter = {
  [field: string]:
    | Exclude<VectorIndexVectorMetadataValue, string[]>
    | null
    | {
        [Op in VectorIndexVectorMetadataFilterOp]?: Exclude<VectorIndexVectorMetadataValue, string[]> | null;
      };
};
export type VectorIndexDistanceMetric = 'euclidean' | 'cosine' | 'dot-product';
export type VectorIndexMetadataRetrievalLevel = 'all' | 'indexed' | 'none';
export interface VectorIndexQueryOptions {
  topK?: number;
  namespace?: string;
  returnValues?: boolean;
  returnMetadata?: boolean | VectorIndexMetadataRetrievalLevel;
  filter?: VectorIndexVectorMetadataFilter;
}
export type VectorIndexIndexConfig =
  | {
      dimensions: number;
      metric: VectorIndexDistanceMetric;
    }
  | {
      preset: string;
    };
export interface VectorIndexIndexDetails {
  readonly id: string;
  name: string;
  description?: string;
  config: VectorIndexIndexConfig;
  vectorsCount: number;
}
export interface VectorIndexIndexInfo {
  vectorCount: number;
  dimensions: number;
  processedUpToDatetime: number;
  processedUpToMutation: number;
}
export interface VectorIndexVector {
  id: string;
  values: VectorFloatArray | number[];
  namespace?: string;
  metadata?: Record<string, VectorIndexVectorMetadata>;
}
export type VectorIndexMatch = Pick<Partial<VectorIndexVector>, 'values'> &
  Omit<VectorIndexVector, 'values'> & {
    /** The score or rank for similarity, when returned as a result */
    score: number;
  };
export interface VectorIndexMatches {
  matches: VectorIndexMatch[];
  count: number;
}
export interface VectorIndexVectorMutation {
  ids: string[];
  count: number;
}
export interface VectorIndexAsyncMutation {
  mutationId: string;
}
export interface VectorIndexIndex {
  describe(): Promise<VectorIndexIndexDetails>;
  query(vector: VectorFloatArray | number[], options?: VectorIndexQueryOptions): Promise<VectorIndexMatches>;
  insert(vectors: VectorIndexVector[]): Promise<VectorIndexVectorMutation>;
  upsert(vectors: VectorIndexVector[]): Promise<VectorIndexVectorMutation>;
  deleteByIds(ids: string[]): Promise<VectorIndexVectorMutation>;
  getByIds(ids: string[]): Promise<VectorIndexVector[]>;
}
export interface VectorIndex {
  describe(): Promise<VectorIndexIndexInfo>;
  query(vector: VectorFloatArray | number[], options?: VectorIndexQueryOptions): Promise<VectorIndexMatches>;
  queryById(vectorId: string, options?: VectorIndexQueryOptions): Promise<VectorIndexMatches>;
  insert(vectors: VectorIndexVector[]): Promise<VectorIndexAsyncMutation>;
  upsert(vectors: VectorIndexVector[]): Promise<VectorIndexAsyncMutation>;
  deleteByIds(ids: string[]): Promise<VectorIndexAsyncMutation>;
  getByIds(ids: string[]): Promise<VectorIndexVector[]>;
}
