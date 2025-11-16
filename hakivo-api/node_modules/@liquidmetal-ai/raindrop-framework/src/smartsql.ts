import { ActorState } from './actor.js';

/**
 * SmartSQL interface for executing SQL queries and natural language queries.
 * Provides database interaction with PII detection and metadata management.
 */
export interface SmartSql {
  /**
   * Execute SQL query or natural language query.
   * @param options - Query parameters with sqlQuery OR textQuery and optional format
   * @returns Query execution results
   */
  executeQuery(options: { textQuery?: string; sqlQuery?: string; format?: 'json' | 'csv' }): Promise<{
    message: string;
    results?: string;
    status: number;
    queryExecuted: string;
    aiReasoning?: string;
  }>;

  /**
   * Get database table metadata.
   * @param tableName - Optional table name filter
   * @returns Table schema information
   */
  getMetadata(tableName?: string): Promise<{
    tables: Array<{
      tableName: string;
      columns: Array<{
        columnName: string;
        dataType: string;
        sampleData?: string;
        nullable: boolean;
        isPrimaryKey: boolean;
      }>;
      createdAt?: string;
      updatedAt?: string;
    }>;
    lastUpdated?: string;
  }>;

  /**
   * Update database table metadata.
   * @param tables - Table metadata to update
   * @param mode - Update mode: 'replace' (default), 'merge', or 'append'
   * @returns Update operation result
   */
  updateMetadata(
    tables: Array<{
      tableName: string;
      columns: Array<{
        columnName: string;
        dataType: string;
        sampleData?: string;
        nullable: boolean;
        isPrimaryKey: boolean;
      }>;
    }>,
    mode?: 'replace' | 'merge' | 'append',
  ): Promise<{
    success: boolean;
    tablesUpdated: number;
    message: string;
  }>;

  /**
   * Get PII detection results.
   * @param tableName - Target table name
   * @param recordId - Optional record ID filter
   * @returns PII detection data
   */
  getPiiData(
    tableName: string,
    recordId?: string,
  ): Promise<{
    piiDetections: Array<{
      detectionId: string;
      tableName: string;
      recordId: string;
      entities: Array<{
        entityType: string;
        confidenceScore: number;
        detectedText: string;
        startPosition: number;
        endPosition: number;
        tokenIndex: number;
      }>;
      detectedAt: string;
    }>;
  }>;

}

/**
 * SmartSQL instance interface for database operations.
 * This represents a specific database/module instance.
 */
export interface SmartSqlInstance {
  state: ActorState;
  env: unknown;

  /**
   * Execute SQL query or natural language query.
   * @param options - Query parameters with sqlQuery OR textQuery and optional format
   * @returns Query execution results
   */
  executeQuery(options: { textQuery?: string; sqlQuery?: string; format?: 'json' | 'csv' }): Promise<{
    message: string;
    results?: string;
    status: number;
    queryExecuted: string;
    aiReasoning?: string;
  }>;

  /**
   * Get database table metadata.
   * @param tableName - Optional table name filter
   * @returns Table schema information
   */
  getMetadata(tableName?: string): Promise<{
    tables: Array<{
      tableName: string;
      columns: Array<{
        columnName: string;
        dataType: string;
        sampleData?: string;
        nullable: boolean;
        isPrimaryKey: boolean;
      }>;
      createdAt?: string;
      updatedAt?: string;
    }>;
    lastUpdated?: string;
  }>;

  /**
   * Update database table metadata.
   * @param tables - Table metadata to update
   * @param mode - Update mode: 'replace' (default), 'merge', or 'append'
   * @returns Update operation result
   */
  updateMetadata(
    tables: Array<{
      tableName: string;
      columns: Array<{
        columnName: string;
        dataType: string;
        sampleData?: string;
        nullable: boolean;
        isPrimaryKey: boolean;
      }>;
    }>,
    mode?: 'replace' | 'merge' | 'append',
  ): Promise<{
    success: boolean;
    tablesUpdated: number;
    message: string;
  }>;

  /**
   * Get PII detection results.
   * @param tableName - Target table name
   * @param recordId - Optional record ID filter
   * @returns PII detection data
   */
  getPiiData(
    tableName: string,
    recordId?: string,
  ): Promise<{
    piiDetections: Array<{
      detectionId: string;
      tableName: string;
      recordId: string;
      entities: Array<{
        entityType: string;
        confidenceScore: number;
        detectedText: string;
        startPosition: number;
        endPosition: number;
        tokenIndex: number;
      }>;
      detectedAt: string;
    }>;
  }>;

}
