/**
 * Abstract base class for implementing HTTP service workers
 * @template Env - The environment type containing runtime specific bindings
 */

import { ExecutionContext, Stub } from './shared.js';

export abstract class Service<Env> {
  ctx: ExecutionContext;
  env: Env;

  constructor(ctx: ExecutionContext, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}

export type ServiceStub<T extends Service<Env>, Env = unknown> = Stub<T>;
