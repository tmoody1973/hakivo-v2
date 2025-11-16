/** Specifies the content type of a queue message */
type QueueContentType = 'text' | 'bytes' | 'json' | 'v8';

/**
 * Represents a message queue that can send individual messages or batches
 * @template Body - The type of the message body
 */
export interface Queue<Body = unknown> {
  /**
   * Sends a single message to the queue
   * @param message - The message body to send
   * @param options - Optional sending configuration
   */
  send(message: Body, options?: QueueSendOptions): Promise<void>;

  /**
   * Sends multiple messages to the queue as a batch
   * @param messages - Iterator of messages to send
   * @param options - Optional batch sending configuration
   */
  sendBatch(messages: Iterable<MessageSendRequest<Body>>, options?: QueueSendBatchOptions): Promise<void>;
}
/** Configuration options for sending a single message */
export interface QueueSendOptions {
  /** The content type of the message */
  contentType?: QueueContentType;
  /** Number of seconds to delay message processing */
  delaySeconds?: number;
}

/** Configuration options for sending a batch of messages */
export interface QueueSendBatchOptions {
  /** Number of seconds to delay processing for all messages in the batch */
  delaySeconds?: number;
}

/**
 * Represents a message to be sent to the queue
 * @template Body - The type of the message body
 */
export interface MessageSendRequest<Body = unknown> {
  /** The message content */
  body: Body;
  /** The content type of the message */
  contentType?: QueueContentType;
  /** Number of seconds to delay message processing */
  delaySeconds?: number;
}

/** Configuration options for retrying a message */
export interface QueueRetryOptions {
  /** Number of seconds to delay before retry attempt */
  delaySeconds?: number;
}
/**
 * Represents a message received from the queue
 * @template Body - The type of the message body
 */
export interface Message<Body = unknown> {
  /** Unique identifier for the message */
  readonly id: string;
  /** Timestamp when the message was sent */
  readonly timestamp: Date;
  /** The message content */
  readonly body: Body;
  /** Number of processing attempts made for this message */
  readonly attempts: number;
  /**
   * Retry processing this message
   * @param options - Optional retry configuration
   */
  retry(options?: QueueRetryOptions): void;
  /** Acknowledge successful processing of this message */
  ack(): void;
}

/**
 * Represents a batch of messages received from the queue
 * @template Body - The type of the message bodies
 */
export interface MessageBatch<Body = unknown> {
  /** Array of messages in this batch */
  readonly messages: readonly Message<Body>[];
  /** Name or identifier of the source queue */
  readonly queue: string;
  /**
   * Retry processing all messages in the batch
   * @param options - Optional retry configuration
   */
  retryAll(options?: QueueRetryOptions): void;
  /** Acknowledge successful processing of all messages in the batch */
  ackAll(): void;
}
