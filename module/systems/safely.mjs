/**
 *  A wrapper method for preventing actor/actor-sheet data races
 *  @param {Object} options - safely configuration
 *  @param {*} options.fallback - What to return on failure
 *  @param {boolean} options.silent - whether to silence logging
 *  @param {string} options.logLevel - 'warn', 'info', or 'debug'
 *  @param {number|null} options.timeout - timeout duration
 *  @param {string|Function|Object} options.context - context info for debugging
 * */
export function safely(options = {}) {
    const {
        fallback = null,
        silent = false,
        timeout = null,
        context = 'unknown'
    } = options;

    return function wrapMethod(fn) {
        return function safeguardedMethod(...args) {
            try {
                const result = fn.apply(this, args);

                // Handle async methods
                if (result instanceof Promise) {
                    let promise = result.catch(error => {
                        return handleError(error, options, fn.name || context, this);
                    });

                    // Add timeout if specified
                    if (timeout) {
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Method timeout')), timeout)
                        );
                        promise = Promise.race([promise, timeoutPromise])
                            .catch(error => handleError(error, options, fn.name || context, this));
                    }

                    return promise;
                }

                return result;
            } catch (error) {
                return handleError(error, options, fn.name || context, this);
            }
        };
    };
}

function handleError(error, options, methodName, context) {
    const { fallback, silent } = options;

    if (!silent) {
        const contextName = context?.constructor?.name || 'UnknownClass';
        console.warn(`Safe method ${contextName}.${methodName} failed:`, {
            error: error.message,
            fallback,
            originalError: error
        });
    }

    return fallback;
}

// Convenience methods for common patterns
safely.silent = (fallback) => safely({ fallback, silent: true });
safely.debug = (fallback) => safely({ fallback });
safely.withTimeout = (fallback, timeout) => safely({ fallback, timeout });
