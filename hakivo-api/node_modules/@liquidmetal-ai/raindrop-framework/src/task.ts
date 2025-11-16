import { ExecutionContext } from './shared.js';

/**
 * Represents a scheduled event, typically from a Cron Trigger
 */
export interface Event {
  /** The value of the Cron Trigger that started the ScheduledEvent */
  cron: string;

  /** The type of event. This will always return "scheduled" */
  type: 'scheduled';

  /**
   * The time the ScheduledEvent was scheduled to be executed in milliseconds since January 1, 1970, UTC.
   * It can be parsed as new Date(event.scheduledTime).
   */
  scheduledTime: number;
}

/**
 * Abstract base class for processing scheduled events, for exampled, triggered crons
 * @template Env - The environment type containing runtime specific bindings
 */
export abstract class Task<Env> {
  ctx: ExecutionContext;
  env: Env;

  constructor(ctx: ExecutionContext, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  abstract handle(event: Event): Promise<void>;
}
