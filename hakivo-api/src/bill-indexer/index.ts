import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    console.log(JSON.stringify(message));
  }
}

export interface Body {
}
