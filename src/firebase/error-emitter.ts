// src/firebase/error-emitter.ts
import { EventEmitter } from 'events';
import type { FirestorePermissionError } from './errors';

type ErrorEvents = {
  'permission-error': (error: FirestorePermissionError) => void;
};

class TypedEventEmitter<T extends Record<string, (...args: any[]) => void>> {
  private emitter = new EventEmitter();

  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean {
    return this.emitter.emit(event as string, ...args);
  }

  on<K extends keyof T>(event: K, listener: T[K]): this {
    this.emitter.on(event as string, listener);
    return this;
  }
}

export const errorEmitter = new TypedEventEmitter<ErrorEvents>();
