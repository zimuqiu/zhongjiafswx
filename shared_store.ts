/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Creates a simple state management store.
 * @template T The type of the state object.
 * @param {T} initialState The initial state.
 * @returns A store object with getState, setState, and subscribe methods.
 */
export function createStore<T extends object>(initialState: T) {
    let state: T = initialState;
    const listeners = new Set<(newState: T, oldState: T) => void>();

    return {
        /**
         * Gets the current state.
         * @returns {T} The current state.
         */
        getState(): T {
            return state;
        },

        /**
         * Updates the state. The updater can be a partial state object or a function
         * that receives the previous state and returns a partial state object.
         * @param {Partial<T> | ((prevState: T) => Partial<T>)} updater
         */
        setState(updater: Partial<T> | ((prevState: T) => Partial<T>)) {
            const oldState = state;
            let nextStateUpdate: Partial<T>;

            if (typeof updater === 'function') {
                nextStateUpdate = (updater as (prevState: T) => Partial<T>)(state);
            } else {
                nextStateUpdate = updater;
            }
            
            state = { ...state, ...nextStateUpdate };
            
            listeners.forEach(listener => listener(state, oldState));
        },

        /**
         * Subscribes to state changes.
         * @param {(newState: T, oldState: T) => void} listener A callback function to be called when the state changes.
         * @returns {() => void} An unsubscribe function.
         */
        subscribe(listener: (newState: T, oldState: T) => void): () => void {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        }
    };
}
