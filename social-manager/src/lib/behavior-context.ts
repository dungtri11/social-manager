import { AsyncLocalStorage } from 'async_hooks';

interface BehaviorContext {
  accountId: string;
}

export const behaviorContext = new AsyncLocalStorage<BehaviorContext>();
