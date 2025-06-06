const exposed = (() => {
    class NMap {
        constructor(parent, prefix) {
            this.data = new Map();
            this.parent = parent;
            this.prefix = prefix;
        }
        get(key) {
            if (this.data.has(key)) {
                return this.data.get(key);
            }
            const value = this.parent.kvRead(`${this.prefix}____${key}`);
            if (value !== undefined) {
                this.data.set(key, value);
            }
            return value;
        }
        set(key, value, tag, secondary_tag) {
            this.data.set(key, value);
            this.parent.addPendingChange(`${this.prefix}____${key}`, value, tag || this.prefix, secondary_tag);
        }
        delete(key, tag, secondary_tag) {
            this.data.delete(key);
            this.parent.addPendingChange(`${this.prefix}____${key}`, undefined, tag || this.prefix, secondary_tag);
        }
    }
    function log(...args) {
        return global.log(...args);
    }
    function ntransfer(origin, destination, mint, amount, args) {
        return global.IRC.ntransfer(origin, destination, mint, amount, args);
    }
    function ntransferToCluster(origin, clusterId, mint, amount, args) {
        return global.IRC.ntransferToCluster(origin, clusterId, mint, amount, args);
    }
    function nmintEdit(mint, totalSupply, admin, meta) {
        return global.IRC.nmintEdit(mint, totalSupply, admin, meta);
    }
    function nwrite(fieldId, rawValue, tag, secondary_tag) {
        return global.IRC.nwrite(fieldId, rawValue, tag, secondary_tag);
    }
    function nread(fieldId, appId) {
        return global.IRC.nread(fieldId, appId);
    }
    function nmint(totalSupply, admin, meta) {
        return global.IRC.nmint(totalSupply, admin, meta);
    }
    class NApp {
        constructor() {
            this.log = global.log;
            this.pendingChanges = new Map();
        }
        signer() {
            return global.IRC.signer;
        }
        appAdmin() {
            return global.IRC.appAdmin;
        }
        appId() {
            return global.IRC.appId;
        }
        time() {
            return global.IRC.time;
        }
        addPendingChange(key, value, tag, secondary_tag) {
            this.pendingChanges.set(key, { value, tag, secondary_tag });
        }
        kvRead(key) {
            throw new Error("kvRead not implemented");
        }
        kvWrite(key, value, tag, secondary_tag) {
            throw new Error("kvWrite not implemented");
        }
        fieldProxy() {
            return {
                set: (target, prop, value) => {
                    if (typeof prop === "string" && !prop.startsWith("_")) {
                        this.pendingChanges.set(prop, { value });
                    }
                    target[prop] = value;
                    return true;
                },
                get: (target, prop, receiver) => {
                    // Handle function calls
                    if (typeof target[prop] === "function") {
                        // Ensure methods are bound to the proxy
                        return target[prop].bind(receiver);
                    }
                    // Handle NMap instances
                    if (target[prop] instanceof NMap) {
                        return target[prop]; // Return the NMap instance directly
                    }
                    // Handle regular properties
                    if (typeof prop === "string" && !prop.startsWith("_")) {
                        if (this.pendingChanges.has(prop)) {
                            const change = this.pendingChanges.get(prop);
                            if (change) {
                                target[prop] = change.value;
                                return change.value;
                            }
                        }
                        const value = this.kvRead(`${prop}`);
                        if (value !== undefined) {
                            target[prop] = value;
                        }
                    }
                    return target[prop];
                },
            };
        }
        static wrapMethod(target, methodName) {
            return function (...args) {
                const app = new target();
                const proxiedApp = new Proxy(app, app.fieldProxy());
                try {
                    const result = proxiedApp[methodName].apply(proxiedApp, args);
                    app.recordChanges();
                    return result;
                }
                catch (error) {
                    throw error;
                }
            };
        }
        recordChanges() {
            for (const [prop, { value, tag, secondary_tag }] of this.pendingChanges.entries()) {
                this.kvWrite(`${prop}`, value, tag, secondary_tag);
            }
            this.pendingChanges.clear();
        }
        static injectKVMethods(nread, nwrite) {
            this.prototype.kvRead = nread;
            this.prototype.kvWrite = nwrite;
        }
    }
    function createWrappers(AppClass) {
        const wrappers = {};
        let currentPrototype = AppClass.prototype;
        while (currentPrototype && currentPrototype !== Object.prototype) {
            const methodNames = Object.getOwnPropertyNames(currentPrototype).filter((name) => typeof currentPrototype[name] === "function" &&
                name !== "constructor" &&
                !wrappers[name]);
            for (const methodName of methodNames) {
                wrappers[methodName] = NApp.wrapMethod(AppClass, methodName);
            }
            currentPrototype = Object.getPrototypeOf(currentPrototype);
        }
        return wrappers;
    }
    // Helper to create all wrappers
    function createExecutableFunctions(AppClass) {
        return createWrappers(AppClass);
    }
    NApp.injectKVMethods((key, appId) => global.IRC.nread(key, appId), (key, value, tag, secondary_tag) => global.IRC.nwrite(key, value, tag, secondary_tag));
    class Counter extends NApp {
        init() {
            this.log("Initializing Counter app");
            this.count = 0;
            this.log("Counter initialized with count:", this.count);
        }
        increment(by = 1) {
            this.log("Increment called with value:", by);
            this.log("Current count before increment:", this.count);
            if (by < 0) {
                this.log("ERROR: Negative increment value provided:", by);
                throw new Error("Increment value must be non-negative");
            }
            if (by === 0) {
                this.log("WARNING: Zero increment value provided, no change will occur");
            }
            const oldCount = this.count;
            this.count += by;
            this.log("Count incremented successfully:", {
                oldValue: oldCount,
                incrementBy: by,
                newValue: this.count
            });
        }
        decrement(by = 1) {
            this.log("Decrement called with value:", by);
            this.log("Current count before decrement:", this.count);
            if (by < 0) {
                this.log("ERROR: Negative decrement value provided:", by);
                throw new Error("Decrement value must be non-negative");
            }
            if (by === 0) {
                this.log("WARNING: Zero decrement value provided, no change will occur");
            }
            if (this.count - by < 0) {
                this.log("WARNING: Decrement would result in negative count:", {
                    currentCount: this.count,
                    decrementBy: by,
                    resultWouldBe: this.count - by
                });
            }
            const oldCount = this.count;
            this.count -= by;
            this.log("Count decremented successfully:", {
                oldValue: oldCount,
                decrementBy: by,
                newValue: this.count
            });
        }
    }
    const { init, increment, decrement } = createExecutableFunctions(Counter);
    // Only expose specified methods
    return {
        init: init,
        increment: increment,
        decrement: decrement
    };
});
// Create function wrappers that forward calls to exposed methods
function init(...args) { return exposed().init(...args); }
function increment(...args) { return exposed().increment(...args); }
function decrement(...args) { return exposed().decrement(...args); }
