var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    class TokenFaucet extends NApp {
        constructor() {
            super(...arguments);
            this.lastClaim = new NMap(this, "last_claim");
        }
        init() {
            this.log("Initializing TokenFaucet app");
            this.faucetToken = "";
            this.isInitialized = false;
            this.totalClaimed = "0";
            this.claimAmount = "1000000000000000000"; // 1 token with 18 decimals
            this.cooldownPeriod = 3600; // 1 hour in seconds
            this.log("TokenFaucet initialized successfully", {
                isInitialized: this.isInitialized,
                claimAmount: this.claimAmount,
                cooldownPeriod: this.cooldownPeriod,
                totalClaimed: this.totalClaimed,
                timestamp: this.time()
            });
        }
        setupFaucet(totalSupply) {
            return __awaiter(this, void 0, void 0, function* () {
                const admin = this.signer();
                this.log("Faucet setup attempt started", {
                    admin,
                    requestedSupply: totalSupply,
                    currentInitStatus: this.isInitialized,
                    timestamp: this.time()
                });
                this.log("Verifying admin permissions for faucet setup");
                if (admin !== this.appAdmin()) {
                    this.log("ERROR: Faucet setup failed - insufficient permissions", {
                        signer: admin,
                        requiredAdmin: this.appAdmin(),
                        action: "setupFaucet"
                    });
                    throw new Error("Only admin can setup faucet");
                }
                this.log("Admin permission check passed");
                this.log("Checking faucet initialization status");
                if (this.isInitialized) {
                    this.log("ERROR: Faucet setup failed - already initialized", {
                        admin,
                        totalSupply,
                        currentFaucetToken: this.faucetToken,
                        initTimestamp: this.time()
                    });
                    throw new Error("Faucet already initialized");
                }
                this.log("Initialization status check passed - faucet not yet initialized");
                this.log("Validating total supply parameter", { totalSupply });
                if (!totalSupply) {
                    this.log("ERROR: Faucet setup failed - total supply is empty or null", {
                        admin,
                        providedSupply: totalSupply
                    });
                    throw new Error("Total supply is required");
                }
                let supplyBigInt;
                try {
                    supplyBigInt = BigInt(totalSupply);
                    this.log("Total supply successfully converted to BigInt", {
                        originalValue: totalSupply,
                        bigIntValue: supplyBigInt.toString()
                    });
                }
                catch (error) {
                    this.log("ERROR: Faucet setup failed - invalid total supply format", {
                        admin,
                        providedSupply: totalSupply,
                        error: error.message
                    });
                    throw new Error("Invalid total supply format");
                }
                if (supplyBigInt <= 0n) {
                    this.log("ERROR: Faucet setup failed - total supply must be positive", {
                        admin,
                        providedSupply: totalSupply,
                        parsedValue: supplyBigInt.toString()
                    });
                    throw new Error("Total supply must be positive");
                }
                this.log("Creating faucet token with nmint", {
                    totalSupply: supplyBigInt.toString(),
                    admin: this.appId(),
                    metadata: {
                        name: "Faucet Token",
                        symbol: "FAUCET",
                        decimals: 18,
                        description: "Free tokens from the faucet"
                    }
                });
                // Create the faucet token
                const mintId = nmint(supplyBigInt, this.appId(), // App is the admin
                JSON.stringify({
                    name: "Faucet Token",
                    symbol: "FAUCET",
                    decimals: 18,
                    description: "Free tokens from the faucet"
                }));
                // Store the mint ID for use in claims
                this.faucetToken = mintId;
                this.log("MONKEEEEEE");
                this.log("MONKEEEEEE");
                this.log("MONKEEEEEE");
                this.log("MONKEEEEEE");
                this.log("MONKEEEEEE");
                this.fiko = 123;
                this.isInitialized = true;
                this.log("MONKEEEEEE!!!!");
                this.log("MONKEEEEEE!!!!");
                this.log("MONKEEEEEE!!!!");
                this.log("MONKEEEEEE!!!!");
                this.log("Faucet setup completed successfully", {
                    admin,
                    totalSupply: supplyBigInt.toString(),
                    isInitialized: this.isInitialized,
                    appId: this.appId(),
                    setupTime: this.time()
                });
            });
        }
        setFaucetToken(mintId) {
            const admin = this.signer();
            this.log("Faucet token setting attempt started", {
                admin,
                providedMintId: mintId,
                currentFaucetToken: this.faucetToken,
                timestamp: this.time()
            });
            this.log("Verifying admin permissions for token setting");
            if (admin !== this.appAdmin()) {
                this.log("ERROR: Set faucet token failed - insufficient permissions", {
                    signer: admin,
                    requiredAdmin: this.appAdmin(),
                    providedMintId: mintId
                });
                throw new Error("Only admin can set faucet token");
            }
            this.log("Admin permission check passed");
            this.log("Validating mint ID parameter", { mintId });
            if (!mintId || mintId.trim().length === 0) {
                this.log("ERROR: Set faucet token failed - invalid mint ID", {
                    admin,
                    providedMintId: mintId
                });
                throw new Error("Valid mint ID is required");
            }
            const previousToken = this.faucetToken;
            this.faucetToken = mintId.trim();
            this.log("Faucet token set successfully", {
                admin,
                previousToken,
                newToken: this.faucetToken,
                updateTime: this.time()
            });
        }
        claim() {
            const user = this.signer();
            const now = this.time();
            this.log("Token claim attempt started", {
                user,
                timestamp: now,
                isInitialized: this.isInitialized,
                faucetToken: this.faucetToken,
                claimAmount: this.claimAmount
            });
            this.log("Checking faucet initialization status");
            if (!this.isInitialized) {
                this.log("ERROR: Claim failed - faucet not initialized", {
                    user,
                    isInitialized: this.isInitialized,
                    faucetToken: this.faucetToken
                });
                throw new Error("Faucet not properly initialized");
            }
            this.log("Checking faucet token availability");
            if (!this.faucetToken) {
                this.log("ERROR: Claim failed - faucet token not set", {
                    user,
                    isInitialized: this.isInitialized,
                    faucetToken: this.faucetToken
                });
                throw new Error("Faucet not properly initialized");
            }
            this.log("Faucet status checks passed");
            this.log("Fetching user last claim time", { user });
            const lastClaimTime = this.lastClaim.get(user) || 0;
            this.log("User claim history retrieved", {
                user,
                lastClaimTime,
                currentTime: now,
                timeSinceLastClaim: now - lastClaimTime
            });
            // Check cooldown
            this.log("Checking cooldown period", {
                user,
                lastClaimTime,
                currentTime: now,
                cooldownPeriod: this.cooldownPeriod,
                timeSinceLastClaim: now - lastClaimTime,
                cooldownRemaining: Math.max(0, this.cooldownPeriod - (now - lastClaimTime))
            });
            if (now - lastClaimTime < this.cooldownPeriod) {
                const timeLeft = this.cooldownPeriod - (now - lastClaimTime);
                this.log("ERROR: Claim failed - cooldown period not met", {
                    user,
                    lastClaimTime,
                    currentTime: now,
                    cooldownPeriod: this.cooldownPeriod,
                    timeLeft,
                    timeSinceLastClaim: now - lastClaimTime
                });
                throw new Error(`Please wait ${timeLeft} seconds before claiming again`);
            }
            this.log("Cooldown check passed - user can claim tokens");
            this.log("Preparing token transfer", {
                from: this.appId(),
                to: user,
                mintId: this.faucetToken,
                amount: this.claimAmount,
                amountBigInt: BigInt(this.claimAmount).toString()
            });
            // Transfer tokens from faucet to user
            ntransfer(this.appId(), user, this.faucetToken, BigInt(this.claimAmount));
            this.log("Token transfer completed successfully");
            // Update claim tracking
            this.log("Updating claim tracking records", {
                user,
                previousLastClaim: lastClaimTime,
                newLastClaim: now,
                claimAmount: this.claimAmount
            });
            this.lastClaim.set(user, now, "token_claim", user);
            const previousTotalClaimed = this.totalClaimed;
            this.totalClaimed = (BigInt(this.totalClaimed) + BigInt(this.claimAmount)).toString();
            this.log("Claim tracking updated successfully", {
                user,
                claimTime: now,
                claimAmount: this.claimAmount,
                previousTotalClaimed,
                newTotalClaimed: this.totalClaimed
            });
            this.log("Tokens claimed successfully", {
                user,
                amount: this.claimAmount,
                claimTime: now,
                totalClaimedOverall: this.totalClaimed,
                nextClaimAvailableAt: now + this.cooldownPeriod
            });
        }
        updateClaimAmount(newAmount) {
            const admin = this.signer();
            this.log("Claim amount update attempt started", {
                admin,
                currentAmount: this.claimAmount,
                requestedAmount: newAmount,
                timestamp: this.time()
            });
            this.log("Verifying admin permissions for claim amount update");
            if (admin !== this.appAdmin()) {
                this.log("ERROR: Update claim amount failed - insufficient permissions", {
                    signer: admin,
                    requiredAdmin: this.appAdmin(),
                    requestedAmount: newAmount
                });
                throw new Error("Only admin can update claim amount");
            }
            this.log("Admin permission check passed");
            this.log("Validating new claim amount", { newAmount });
            if (!newAmount) {
                this.log("ERROR: Update claim amount failed - amount is empty or null", {
                    admin,
                    providedAmount: newAmount
                });
                throw new Error("Claim amount is required");
            }
            let amountBigInt;
            try {
                amountBigInt = BigInt(newAmount);
                this.log("New claim amount successfully converted to BigInt", {
                    originalValue: newAmount,
                    bigIntValue: amountBigInt.toString()
                });
            }
            catch (error) {
                this.log("ERROR: Update claim amount failed - invalid amount format", {
                    admin,
                    providedAmount: newAmount,
                    error: error.message
                });
                throw new Error("Invalid claim amount format");
            }
            if (amountBigInt <= 0n) {
                this.log("ERROR: Update claim amount failed - amount must be positive", {
                    admin,
                    providedAmount: newAmount,
                    parsedValue: amountBigInt.toString()
                });
                throw new Error("Claim amount must be positive");
            }
            const previousAmount = this.claimAmount;
            this.claimAmount = newAmount;
            this.log("Claim amount updated successfully", {
                admin,
                previousAmount,
                newAmount: this.claimAmount,
                updateTime: this.time()
            });
        }
        updateCooldown(newCooldown) {
            const admin = this.signer();
            this.log("Cooldown update attempt started", {
                admin,
                currentCooldown: this.cooldownPeriod,
                requestedCooldown: newCooldown,
                timestamp: this.time()
            });
            this.log("Verifying admin permissions for cooldown update");
            if (admin !== this.appAdmin()) {
                this.log("ERROR: Update cooldown failed - insufficient permissions", {
                    signer: admin,
                    requiredAdmin: this.appAdmin(),
                    requestedCooldown: newCooldown
                });
                throw new Error("Only admin can update cooldown");
            }
            this.log("Admin permission check passed");
            this.log("Validating new cooldown value", { newCooldown });
            if (typeof newCooldown !== "number") {
                this.log("ERROR: Update cooldown failed - invalid type", {
                    admin,
                    providedCooldown: newCooldown,
                    providedType: typeof newCooldown
                });
                throw new Error("Cooldown must be a number");
            }
            if (newCooldown < 0) {
                this.log("ERROR: Update cooldown failed - negative value not allowed", {
                    admin,
                    providedCooldown: newCooldown
                });
                throw new Error("Cooldown must be non-negative");
            }
            if (newCooldown > 86400 * 7) { // 1 week max
                this.log("WARNING: Very long cooldown period set", {
                    admin,
                    newCooldown,
                    maxRecommended: 86400 * 7,
                    warningMessage: "Cooldown longer than 1 week"
                });
            }
            const previousCooldown = this.cooldownPeriod;
            this.cooldownPeriod = newCooldown;
            this.log("Cooldown period updated successfully", {
                admin,
                previousCooldown,
                newCooldown: this.cooldownPeriod,
                updateTime: this.time()
            });
        }
    }
    const { init, setupFaucet, setFaucetToken, claim, updateClaimAmount, updateCooldown } = createExecutableFunctions(TokenFaucet);
    // Only expose specified methods
    return {
        init: init,
        setupFaucet: setupFaucet,
        setFaucetToken: setFaucetToken,
        claim: claim,
        updateClaimAmount: updateClaimAmount,
        updateCooldown: updateCooldown
    };
});
// Create function wrappers that forward calls to exposed methods
function init(...args) { return exposed().init(...args); }
function setupFaucet(...args) { return exposed().setupFaucet(...args); }
function setFaucetToken(...args) { return exposed().setFaucetToken(...args); }
function claim(...args) { return exposed().claim(...args); }
function updateClaimAmount(...args) { return exposed().updateClaimAmount(...args); }
function updateCooldown(...args) { return exposed().updateCooldown(...args); }
