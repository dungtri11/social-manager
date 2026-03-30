import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { redisConnectionOptions } from '../lib/redis';

const CHANNEL = 'behavior:events';

export interface AccountBehaviorState {
  accountId: string;
  behavior: string;
  status: 'idle' | 'processing';
}

class BehaviorEventsService extends EventEmitter {
  private states: Map<string, { behavior: string; status: 'idle' | 'processing' }> = new Map();
  private publisher: Redis | null = null;

  /** Call once in the worker process to enable Redis publishing. */
  initPublisher(): void {
    this.publisher = new Redis(redisConnectionOptions);
  }

  /** Call once in the server process to receive events from workers. */
  initSubscriber(): void {
    const sub = new Redis(redisConnectionOptions);
    sub.subscribe(CHANNEL, (err) => {
      if (err) console.error('[behavior-events] Redis subscribe error:', err);
    });
    sub.on('message', (_channel: string, message: string) => {
      try {
        const event: AccountBehaviorState = JSON.parse(message);
        // Update local state and re-emit so SSE clients get it
        const state = this.getOrCreate(event.accountId);
        state.behavior = event.behavior;
        state.status = event.status;
        this.emit('update', event);
      } catch { /* ignore malformed */ }
    });
  }

  private publish(event: AccountBehaviorState): void {
    if (this.publisher) {
      this.publisher.publish(CHANNEL, JSON.stringify(event)).catch(() => {});
    }
  }

  emitBehavior(accountId: string, message: string): void {
    const state = this.getOrCreate(accountId);
    state.behavior = message;
    const event: AccountBehaviorState = { accountId, behavior: state.behavior, status: state.status };
    this.emit('update', event);
    this.publish(event);
  }

  setStatus(accountId: string, status: 'idle' | 'processing'): void {
    const state = this.getOrCreate(accountId);
    state.status = status;
    if (status === 'idle') state.behavior = '';
    const event: AccountBehaviorState = { accountId, behavior: state.behavior, status: state.status };
    this.emit('update', event);
    this.publish(event);
  }

  getAllStates(): Record<string, { behavior: string; status: 'idle' | 'processing' }> {
    const result: Record<string, { behavior: string; status: 'idle' | 'processing' }> = {};
    for (const [id, state] of this.states) {
      result[id] = { ...state };
    }
    return result;
  }

  private getOrCreate(accountId: string): { behavior: string; status: 'idle' | 'processing' } {
    if (!this.states.has(accountId)) {
      this.states.set(accountId, { behavior: '', status: 'idle' });
    }
    return this.states.get(accountId)!;
  }
}

export const behaviorEventsService = new BehaviorEventsService();
export default behaviorEventsService;
