import { ExecutionContext } from './shared.js';
import { Message, MessageBatch } from './queue.js';

/**
 * Abstract base class for processing individual messages from a queue.
 * @template T - The type of message to process
 * @template Env - The environment type containing runtime specific bindings
 */
export abstract class Each<T, Env> {
  ctx: ExecutionContext;
  env: Env;

  constructor(ctx: ExecutionContext, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  abstract process(message: Message<T>): Promise<void>;
}

/**
 * Abstract base class for processing batches of messages from a queue.
 * @template T - The type of messages to process
 * @template Env - The environment type containing runtime specific bindings
 */
export abstract class Batch<T, Env> {
  ctx: ExecutionContext;
  env: Env;

  constructor(ctx: ExecutionContext, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  abstract process(batch: MessageBatch<T>): Promise<void>;
}
