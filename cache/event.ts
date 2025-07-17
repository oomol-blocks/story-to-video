export interface CacheEvents {
    'cache:block:invalidated': { blockId: string; fileIds: string[] };
    'cache:cleared': { fileIds: string[] };
}

export type EventListener = (...args: any[]) => void;

export class EventEmitter {
    private listeners: Map<string, EventListener[]> = new Map();

    on(event: string, listener: EventListener): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
    }

    emit(event: string, data?: any): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    off(event: string, listener: EventListener): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(listener);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    }
}
