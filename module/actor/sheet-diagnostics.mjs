// module/actor/sheet-diagnostics.mjs
export class ActorSheetDiagnostics {
    constructor(sheet) {
        this.sheet = sheet;
        this.actor = sheet.actor;
        this.diagnosticId = foundry.utils.randomID();
        this.startTime = Date.now();
        this.checkpoints = new Map();
        this.failures = [];
        this.isRecovering = false;
    }

    // Called at the start of each major sheet lifecycle method
    checkpoint(name, data = {}) {
        const timestamp = Date.now();
        const checkpoint = {
            name,
            timestamp,
            duration: timestamp - this.startTime,
            data: this.sanitizeData(data),
            stackTrace: new Error().stack
        };

        this.checkpoints.set(name, checkpoint);
        console.log(`🔍 [${this.actor.name}] Checkpoint: ${name} (${checkpoint.duration}ms)`);
        return checkpoint;
    }

    // Record failure with full context
    recordFailure(method, error, context = {}) {
        const failure = {
            method,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context: this.sanitizeData(context),
            timestamp: Date.now(),
            checkpoints: Array.from(this.checkpoints.values()),
            actorState: this.captureActorState(),
            sheetState: this.captureSheetState()
        };

        this.failures.push(failure);
        console.error(`🚨 [${this.actor.name}] Sheet failure in ${method}:`, failure);

        return failure;
    }

    // Comprehensive actor state capture
    captureActorState() {
        try {
            return {
                id: this.actor.id,
                name: this.actor.name,
                type: this.actor.type,
                hasSystem: !!this.actor.system,
                systemKeys: this.actor.system ? Object.keys(this.actor.system) : [],
                hasItems: !!this.actor.items,
                itemCount: this.actor.items?.size || 0,
                hasAttributes: !!this.actor.system?.attributes,
                attributeKeys: this.actor.system?.attributes ? Object.keys(this.actor.system.attributes) : [],
                systemsInitialized: this.actor._systemsInitialized,
                hasAttributeSystem: !!this.actor.attributeSystem,
                hasInventorySystem: !!this.actor.inventorySystem,
                hasBonusSystem: !!this.actor.bonusSystem,
                flags: this.actor.flags || {},
                isOwner: this.actor.isOwner,
                permission: this.actor.permission
            };
        } catch (error) {
            return { error: error.message, captureFailure: true };
        }
    }

    // Sheet-specific state capture
    captureSheetState() {
        try {
            return {
                rendered: this.sheet.rendered,
                position: this.sheet.position,
                minimized: this.sheet._minimized,
                componentsInitialized: this.sheet._componentsInitialized,
                hasEventRegistry: !!this.sheet.eventRegistry,
                hasRollHandler: !!this.sheet.rollHandler,
                hasStateManager: !!this.sheet.stateManager,
                hasDataContextBuilder: !!this.sheet.dataContextBuilder,
                activeTab: this.sheet._tabs?.[0]?.active,
                element: !!this.sheet.element,
                form: !!this.sheet.form
            };
        } catch (error) {
            return { error: error.message, captureFailure: true };
        }
    }

    sanitizeData(data) {
        try {
            return JSON.parse(JSON.stringify(data, (key, value) => {
                if (typeof value === 'function') return '[Function]';
                if (value instanceof HTMLElement) return '[HTMLElement]';
                if (value instanceof Error) return { name: value.name, message: value.message };
                return value;
            }));
        } catch {
            return { sanitizationFailed: true, type: typeof data };
        }
    }

    // Generate comprehensive diagnostic report
    generateReport() {
        return {
            diagnosticId: this.diagnosticId,
            actor: this.actor.name,
            totalDuration: Date.now() - this.startTime,
            checkpoints: Array.from(this.checkpoints.values()),
            failures: this.failures,
            finalState: {
                actor: this.captureActorState(),
                sheet: this.captureSheetState()
            },
            recommendations: this.generateRecommendations()
        };
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.failures.length > 0) {
            const lastFailure = this.failures[this.failures.length - 1];

            if (lastFailure.method === 'getData' && !lastFailure.actorState.systemsInitialized) {
                recommendations.push('CRITICAL: Actor systems not initialized - try actor recreation');
            }

            if (lastFailure.actorState.hasSystem === false) {
                recommendations.push('FATAL: Actor.system is missing - actor data corruption detected');
            }

            if (lastFailure.sheetState.componentsInitialized === false) {
                recommendations.push('Sheet components failed to initialize - check for missing dependencies');
            }
        }

        return recommendations;
    }
}

// Enhanced Actor Sheet with comprehensive error boundaries
export class RobustActorSheetMixin {
    initializeDiagnostics() {
        this.diagnostics = new ActorSheetDiagnostics(this);
        this._setupGlobalErrorHandling();
    }

    _setupGlobalErrorHandling() {
        // Wrap all async methods with error boundaries
        const asyncMethods = ['getData', '_render', 'activateListeners', '_updateObject'];

        asyncMethods.forEach(methodName => {
            if (typeof this[methodName] === 'function') {
                const originalMethod = this[methodName];
                this[methodName] = this._wrapWithErrorBoundary(originalMethod, methodName);
            }
        });
    }

    _wrapWithErrorBoundary(method, methodName) {
        return async function(...args) {
            try {
                this.diagnostics?.checkpoint(`${methodName}_start`);
                const result = await method.apply(this, args);
                this.diagnostics?.checkpoint(`${methodName}_success`);
                return result;
            } catch (error) {
                const failure = this.diagnostics?.recordFailure(methodName, error, { args });

                // Attempt recovery based on the failure type
                const recovered = await this._attemptRecovery(methodName, error, failure);

                if (!recovered) {
                    // If recovery fails, provide user feedback and force crash
                    this._handleUnrecoverableFailure(methodName, error, failure);
                    throw error; // Re-throw to maintain error propagation
                }

                return recovered;
            }
        }.bind(this);
    }

    async _attemptRecovery(methodName, error, failure) {
        if (this.diagnostics.isRecovering) {
            console.warn('Already in recovery mode, preventing infinite loop');
            return false;
        }

        this.diagnostics.isRecovering = true;
        console.warn(`🔧 Attempting recovery for ${methodName} failure...`);

        try {
            switch (methodName) {
                case 'getData':
                    return await this._recoverGetData(error, failure);
                case '_render':
                    return await this._recoverRender(error, failure);
                case 'activateListeners':
                    return await this._recoverActivateListeners(error, failure);
                default:
                    return false;
            }
        } catch (recoveryError) {
            console.error('Recovery failed:', recoveryError);
            return false;
        } finally {
            this.diagnostics.isRecovering = false;
        }
    }

    async _recoverGetData(error, failure) {
        console.log('🔧 Attempting getData recovery...');

        // Check if actor systems failed to initialize
        if (!this.actor._systemsInitialized) {
            console.warn('Actor systems not initialized, forcing initialization...');
            try {
                this.actor.initializeComponents();
                this.actor._validateAllSystems();
                this.actor._systemsInitialized = true;

                // Try getData again with fresh systems
                return await this._safeGetData();
            } catch (initError) {
                console.error('Actor system recovery failed:', initError);
                return this._buildEmergencyContext();
            }
        }

        // Check if sheet components failed
        if (!this._componentsInitialized) {
            console.warn('Sheet components not initialized, forcing initialization...');
            try {
                this.initializeMixinsAndComponents();
                this._componentsInitialized = true;
                return await this._safeGetData();
            } catch (compError) {
                console.error('Sheet component recovery failed:', compError);
                return this._buildEmergencyContext();
            }
        }

        return false;
    }

    async _safeGetData() {
        try {
            const context = super.getData();
            return this.dataContextBuilder?.buildCompleteContext(context) || context;
        } catch (error) {
            console.error('Safe getData still failed:', error);
            return this._buildEmergencyContext();
        }
    }

    _buildEmergencyContext() {
        console.warn('🚨 Building emergency context - sheet will be read-only');

        return {
            actor: this.actor,
            system: this.actor.system || {},
            items: this.actor.items || new Collection(),
            rollData: {},
            flags: this.actor.flags || {},
            editMode: false,
            emergencyMode: true,
            emergencyMessage: 'Sheet loaded in emergency mode. Some features may be unavailable.',
            weaponAnalysis: { hasWeapons: false, attackButtonType: 'generic' },
            hasAvailableFeatures: false,
            availableClasses: [],
            hasAcrobatTraining: false
        };
    }

    async _recoverRender(error, failure) {
        console.log('🔧 Attempting render recovery...');

        // Try to clear any corrupted state
        this._element = null;
        this._minimized = false;

        // Force re-initialization of components
        this._componentsInitialized = false;

        try {
            // Get fresh context
            const context = await this.getData();
            if (context.emergencyMode) {
                ui.notifications.warn(`${this.actor.name} sheet loaded in emergency mode`);
            }
            return context;
        } catch (renderError) {
            console.error('Render recovery failed:', renderError);
            return false;
        }
    }

    async _recoverActivateListeners(error, failure) {
        console.log('🔧 Attempting listener recovery...');

        try {
            // Re-initialize event system
            if (this.eventRegistry) {
                this.eventRegistry = new EventHandlerRegistry(this);
            }
            return true;
        } catch (listenerError) {
            console.error('Listener recovery failed:', listenerError);
            return false;
        }
    }

    _handleUnrecoverableFailure(methodName, error, failure) {
        const report = this.diagnostics.generateReport();

        console.group('🚨 UNRECOVERABLE SHEET FAILURE');
        console.error('Method:', methodName);
        console.error('Error:', error);
        console.error('Full Report:', report);
        console.groupEnd();

        // Show user a helpful error with recovery options
        const dialog = new Dialog({
            title: `Sheet Error: ${this.actor.name}`,
            content: `
                <div style="margin-bottom: 15px;">
                    <strong>The character sheet failed to load properly.</strong>
                </div>
                <details style="margin-bottom: 15px;">
                    <summary>Technical Details</summary>
                    <pre style="font-size: 11px; max-height: 200px; overflow-y: auto;">${error.message}\n\nRecommendations:\n${report.recommendations.join('\n')}</pre>
                </details>
                <div style="font-size: 12px; color: #666;">
                    Choose an option to continue:
                </div>
            `,
            buttons: {
                emergency: {
                    label: "Emergency Mode",
                    callback: () => this._forceEmergencyMode()
                },
                refresh: {
                    label: "Refresh Sheet",
                    callback: () => this._forceRefresh()
                },
                recreate: {
                    label: "Recreate Actor",
                    callback: () => this._suggestRecreation()
                }
            },
            default: "refresh"
        });

        dialog.render(true);
    }

    async _forceEmergencyMode() {
        this._emergencyMode = true;
        this.close();
        setTimeout(() => this.render(true), 100);
    }

    async _forceRefresh() {
        this.close();
        delete this.actor._systemsInitialized;
        delete this._componentsInitialized;
        setTimeout(() => this.render(true), 100);
    }

    _suggestRecreation() {
        const message = `
            <p>Consider recreating the actor "${this.actor.name}" if problems persist.</p>
            <p><small>This preserves items but may reset calculated values.</small></p>
        `;

        new Dialog({
            title: "Recreation Recommended",
            content: message,
            buttons: {
                ok: { label: "Understood" }
            }
        }).render(true);
    }
}

// Add diagnostic commands for GMs
export function setupDiagnosticCommands() {
    if (!game.user.isGM) return;

    game.glog2d6 = game.glog2d6 || {};

    game.glog2d6.diagnoseActor = function(actorId) {
        const actor = game.actors.get(actorId);
        if (!actor) {
            console.error('Actor not found:', actorId);
            return;
        }

        const sheet = actor.sheet;
        if (!sheet?.diagnostics) {
            console.warn('No diagnostics available for this actor');
            return;
        }

        const report = sheet.diagnostics.generateReport();
        console.group(`🔍 Diagnostic Report: ${actor.name}`);
        console.log(report);
        console.groupEnd();

        return report;
    };

    game.glog2d6.forceActorRecovery = async function(actorId) {
        const actor = game.actors.get(actorId);
        if (!actor) {
            console.error('Actor not found:', actorId);
            return;
        }

        console.log(`🔧 Forcing recovery for ${actor.name}...`);

        // Close existing sheet
        if (actor.sheet.rendered) {
            actor.sheet.close();
        }

        // Reset actor systems
        delete actor._systemsInitialized;
        actor.initializeComponents();

        // Wait a moment then re-render
        setTimeout(() => actor.sheet.render(true), 200);

        ui.notifications.info(`Recovery attempted for ${actor.name}`);
    };
}
