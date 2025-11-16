/** Metadata about a SQL operation */
export interface SqlMeta {
  /** Duration of the operation in milliseconds */
  duration: number;
  /** Size of the database after the operation in bytes */
  size_after: number;
  /** Number of rows read during the operation */
  rows_read: number;
  /** Number of rows written during the operation */
  rows_written: number;
  /** ID of the last inserted row */
  last_row_id: number;
  /** Whether the database was modified */
  changed_db: boolean;
  /** Number of rows modified */
  changes: number;
}
/** Response from a successful SQL operation */
export interface SqlResponse {
  /** Indicates successful completion */
  success: true;
  /** Metadata about the operation */
  meta: SqlMeta & Record<string, unknown>;
  /** Error will never be present for successful operations */
  error?: never;
}
/** Result of a SQL query that returns data */
export type SqlResult<T = unknown> = SqlResponse & {
  /** Array of query results */
  results: T[];
};
/** Result of executing a SQL statement */
export interface SqlExecResult {
  /** Number of statements executed */
  count: number;
  /** Duration of execution in milliseconds */
  duration: number;
}
/** Interface for interacting with a SQL database */
export interface SqlDatabase {
  /** Prepares a SQL statement for execution
   * @param query The SQL query to prepare
   * @returns A prepared statement ready for execution
   */
  prepare(query: string): SqlPreparedStatement;

  /** Executes multiple prepared statements in a batch
   * @param statements Array of prepared statements to execute
   * @returns Promise resolving to array of results
   */
  batch<T = unknown>(statements: SqlPreparedStatement[]): Promise<SqlResult<T>[]>;

  /** Executes a SQL query directly
   * @param query The SQL query to execute
   * @returns Promise resolving to execution result
   */
  exec(query: string): Promise<SqlExecResult>;
}
/** Interface for a prepared SQL statement ready for execution */
export interface SqlPreparedStatement {
  /** Binds values to the prepared statement
   * @param values Values to bind to the statement
   * @returns The prepared statement for chaining
   */
  bind(...values: unknown[]): SqlPreparedStatement;

  /** Gets the first result column by name
   * @param colName Name of the column to retrieve
   * @returns Promise resolving to the column value or null
   */
  first<T = unknown>(colName: string): Promise<T | null>;

  /** Gets the first result row
   * @returns Promise resolving to the row or null
   */
  first<T = Record<string, unknown>>(): Promise<T | null>;

  /** Executes the statement and returns results
   * @returns Promise resolving to query results
   */
  run<T = Record<string, unknown>>(): Promise<SqlResult<T>>;

  /** Executes the statement and returns all results
   * @returns Promise resolving to all query results
   */
  all<T = Record<string, unknown>>(): Promise<SqlResult<T>>;

  /** Gets raw results with optional column names
   * @param options Configuration for raw results
   * @returns Promise resolving to results array with column names
   */
  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;

  /** Gets raw results without column names
   * @param options Configuration for raw results
   * @returns Promise resolving to results array
   */
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;

  /**
   * This SQL query
   */
  readonly query: string;
}
