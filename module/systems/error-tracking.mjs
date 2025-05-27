// module/systems/error-tracking.mjs
export const ErrorTrackingMixin = {
    _initializeErrorTracking() {
        this._errorTracker = {
            errors: [],
            maxErrors: 10,
            trackingEnabled: true,
            logLevel: 'error'
        };

        // Wrap critical sheet methods
        this._wrapCriticalMethods();

        // Auto-wrap all event handler methods
        this._autoWrapEventHandlers();
    },

    _wrapCriticalMethods() {
        const criticalMethods = [
            'getData',
            'activateListeners',
            '_render',
            '_onSubmit',
            '_updateObject'
        ];

        criticalMethods.forEach(methodName => {
            if (typeof this[methodName] === 'function') {
                this._wrapMethodWithErrorTracking(methodName);
            }
        });
    },

    _autoWrapEventHandlers() {
        // Get all methods from the prototype chain
        let proto = Object.getPrototypeOf(this);
        const wrappedMethods = new Set();

        // Walk up the prototype chain to catch inherited methods
        while (proto && proto !== ActorSheet.prototype && proto !== Object.prototype) {
            Object.getOwnPropertyNames(proto)
                .filter(name =>
                    name.startsWith('_on') &&
                    typeof this[name] === 'function' &&
                    !wrappedMethods.has(name)
                )
                .forEach(methodName => {
                    console.log(`Auto-wrapping event handler: ${methodName}`);
                    this[methodName] = this._wrapEventHandler(this[methodName].bind(this));
                    wrappedMethods.add(methodName);
                });

            proto = Object.getPrototypeOf(proto);
        }

        console.log(`Auto-wrapped ${wrappedMethods.size} event handlers:`, [...wrappedMethods]);
    },

    _wrapMethodWithErrorTracking(methodName) {
        const originalMethod = this[methodName];

        this[methodName] = async function(...args) {
            try {
                return await originalMethod.apply(this, args);
            } catch (error) {
                this._trackError(error, methodName, args);
                throw error; // Re-throw to maintain normal error handling
            }
        };
    },

    _wrapEventHandler(handler) {
        const handlerName = handler.name || 'anonymousEventHandler';

        return async (event) => {
            try {
                return await handler(event);
            } catch (error) {
                this._trackError(error, handlerName, [this._sanitizeEvent(event)]);

                // User-friendly error notification
                const message = `Action failed: ${error.message}`;
                ui.notifications.error(message);

                // Don't re-throw for event handlers - just log and notify
                console.error(`Event handler ${handlerName} failed:`, error);
            }
        };
    },

    _sanitizeEvent(event) {
        return {
            type: event?.type,
            target: event?.target?.tagName,
            currentTarget: event?.currentTarget?.tagName,
            dataset: event?.currentTarget?.dataset || {}
        };
    },

    _trackError(error, methodName, args = []) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            method: methodName,
            className: this.constructor.name,
            actorId: this.actor?.id,
            actorName: this.actor?.name,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            args: this._sanitizeArgs(args),
            context: this._getErrorContext()
        };

        // Store error
        this._errorTracker.errors.push(errorInfo);

        // Limit stored errors
        if (this._errorTracker.errors.length > this._errorTracker.maxErrors) {
            this._errorTracker.errors.shift();
        }

        // Log detailed error
        this._logDetailedError(errorInfo);

        // Notify user if critical
        if (this._isCriticalError(methodName)) {
            this._notifyUser(errorInfo);
        }
    },

    _sanitizeArgs(args) {
        return args.map(arg => {
            if (arg && typeof arg === 'object') {
                if (arg.constructor?.name === 'Object') {
                    return { type: 'Object', keys: Object.keys(arg) };
                }
                return { type: arg.constructor.name };
            }
            return { type: typeof arg, value: String(arg).substring(0, 100) };
        });
    },

    _getErrorContext() {
        return {
            editMode: this.actor?.getFlag?.("glog2d6", "editMode"),
            rendered: this.rendered,
            minimized: this._minimized,
            position: { ...this.position },
            activeTab: this._tabs?.[0]?.active,
            systemData: {
                hasAttributes: !!this.actor?.system?.attributes,
                hasItems: !!this.actor?.items?.size,
                itemCount: this.actor?.items?.size || 0,
                actorType: this.actor?.type
            }
        };
    },

    _logDetailedError(errorInfo) {
        console.group(`🚨 ${errorInfo.className}.${errorInfo.method} Error`);
        console.error('Error:', errorInfo.error.message);
        console.error('Stack:', errorInfo.error.stack);
        console.log('Actor:', errorInfo.actorName, `(${errorInfo.actorId})`);
        console.log('Context:', errorInfo.context);
        console.log('Args:', errorInfo.args);
        console.log('Timestamp:', errorInfo.timestamp);
        console.groupEnd();
    },

    _isCriticalError(methodName) {
        const criticalMethods = ['getData', '_render', 'activateListeners'];
        return criticalMethods.includes(methodName);
    },

    _notifyUser(errorInfo) {
        const shortMessage = `Sheet error in ${errorInfo.method}: ${errorInfo.error.message}`;
        ui.notifications.error(shortMessage, { permanent: true });
    },

    // Debug methods
    getErrorHistory() {
        return [...this._errorTracker.errors];
    },

    clearErrorHistory() {
        this._errorTracker.errors = [];
    },

    getLastError() {
        return this._errorTracker.errors[this._errorTracker.errors.length - 1];
    }
};
