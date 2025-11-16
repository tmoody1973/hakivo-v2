import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

export default class extends Task<Env> {
  async handle(event: Event): Promise<void> {
    console.log(JSON.stringify(event));
  }
}
