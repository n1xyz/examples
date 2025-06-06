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
    let EscrowStatus;
    (function (EscrowStatus) {
        EscrowStatus["PENDING"] = "pending";
        EscrowStatus["COMPLETED"] = "completed";
        EscrowStatus["DISPUTED"] = "disputed";
        EscrowStatus["CANCELLED"] = "cancelled";
    })(EscrowStatus || (EscrowStatus = {}));
    class EscrowContract extends NApp {
        constructor() {
            super(...arguments);
            this.escrows = new NMap(this, "escrows");
        }
        init() {
            this.escrowCount = 0;
            this.feePercentage = 250; // 2.5% default fee
            this.testTokenMintId = ""; // Initialize empty
        }
        createEscrow(seller, arbiter, mintId, amount, description) {
            if (!seller || !arbiter || !mintId || !amount) {
                throw new Error("All parameters are required");
            }
            if (BigInt(amount) <= 0) {
                throw new Error("Amount must be positive");
            }
            const buyer = this.signer();
            if (buyer === seller) {
                throw new Error("Buyer and seller cannot be the same");
            }
            const escrowId = `escrow_${++this.escrowCount}`;
            // Transfer tokens from buyer to escrow contract
            ntransfer(buyer, this.appId(), mintId, BigInt(amount));
            const escrowData = {
                buyer,
                seller,
                arbiter,
                mintId,
                amount,
                status: EscrowStatus.PENDING,
                createdAt: this.time(),
                description
            };
            this.escrows.set(escrowId, escrowData, "escrow_created", buyer);
            this.log("Escrow created:", { escrowId, buyer, seller, amount });
        }
        completeEscrow(escrowId) {
            const escrow = this.escrows.get(escrowId);
            if (!escrow) {
                throw new Error("Escrow not found");
            }
            if (escrow.status !== EscrowStatus.PENDING) {
                throw new Error("Escrow is not pending");
            }
            const signer = this.signer();
            if (signer !== escrow.buyer) {
                throw new Error("Only buyer can complete escrow");
            }
            // Calculate fee
            const totalAmount = BigInt(escrow.amount);
            const feeAmount = (totalAmount * BigInt(this.feePercentage)) / BigInt(10000);
            const sellerAmount = totalAmount - feeAmount;
            // Transfer to seller (minus fee)
            ntransfer(this.appId(), escrow.seller, escrow.mintId, sellerAmount);
            // Keep fee in contract (could be withdrawn by admin later)
            escrow.status = EscrowStatus.COMPLETED;
            this.escrows.set(escrowId, escrow, "escrow_completed", escrow.buyer);
            this.log("Escrow completed:", {
                escrowId,
                sellerAmount: sellerAmount.toString(),
                feeAmount: feeAmount.toString()
            });
        }
        disputeEscrow(escrowId) {
            const escrow = this.escrows.get(escrowId);
            if (!escrow) {
                throw new Error("Escrow not found");
            }
            if (escrow.status !== EscrowStatus.PENDING) {
                throw new Error("Escrow is not pending");
            }
            const signer = this.signer();
            if (signer !== escrow.buyer && signer !== escrow.seller) {
                throw new Error("Only buyer or seller can dispute escrow");
            }
            escrow.status = EscrowStatus.DISPUTED;
            this.escrows.set(escrowId, escrow, "escrow_disputed", signer);
            this.log("Escrow disputed:", { escrowId, disputedBy: signer });
        }
        resolveDispute(escrowId, refundToBuyer) {
            const escrow = this.escrows.get(escrowId);
            if (!escrow) {
                throw new Error("Escrow not found");
            }
            if (escrow.status !== EscrowStatus.DISPUTED) {
                throw new Error("Escrow is not disputed");
            }
            const signer = this.signer();
            if (signer !== escrow.arbiter) {
                throw new Error("Only arbiter can resolve dispute");
            }
            const amount = BigInt(escrow.amount);
            const recipient = refundToBuyer ? escrow.buyer : escrow.seller;
            // Transfer full amount to resolved party (no fee on dispute resolution)
            ntransfer(this.appId(), recipient, escrow.mintId, amount);
            escrow.status = EscrowStatus.COMPLETED;
            this.escrows.set(escrowId, escrow, "dispute_resolved", signer);
            this.log("Dispute resolved:", {
                escrowId,
                recipient,
                refundToBuyer,
                amount: amount.toString()
            });
        }
        cancelEscrow(escrowId) {
            const escrow = this.escrows.get(escrowId);
            if (!escrow) {
                throw new Error("Escrow not found");
            }
            if (escrow.status !== EscrowStatus.PENDING) {
                throw new Error("Escrow is not pending");
            }
            const signer = this.signer();
            if (signer !== escrow.seller) {
                throw new Error("Only seller can cancel escrow");
            }
            // Refund to buyer
            ntransfer(this.appId(), escrow.buyer, escrow.mintId, BigInt(escrow.amount));
            escrow.status = EscrowStatus.CANCELLED;
            this.escrows.set(escrowId, escrow, "escrow_cancelled", signer);
            this.log("Escrow cancelled:", { escrowId });
        }
        updateFeePercentage(newFee) {
            if (this.signer() !== this.appAdmin()) {
                throw new Error("Only admin can update fee");
            }
            if (newFee < 0 || newFee > 1000) { // Max 10%
                throw new Error("Fee must be between 0 and 1000 basis points");
            }
            this.feePercentage = newFee;
            this.log("Fee percentage updated:", newFee);
        }
        mintTestToken(totalSupply, metadata) {
            if (this.testTokenMintId) {
                throw new Error("Test token already minted");
            }
            // Create a test token for escrow operations
            const mintId = nmint(BigInt(totalSupply), this.appId(), // Signer becomes admin
            metadata); // Cast to string as nmint returns string in runtime
            // Store the mint ID in contract state
            this.testTokenMintId = mintId;
            this.log("Test token minted:", { mintId, totalSupply, admin: this.signer() });
        }
        distributeTokens(recipient, mintId, amount) {
            // Transfer tokens from current signer to recipient
            ntransfer(this.appId(), recipient, mintId, BigInt(amount));
            this.log("Tokens distributed:", { recipient, mintId, amount });
        }
    }
    const { init, createEscrow, completeEscrow, disputeEscrow, resolveDispute, cancelEscrow, updateFeePercentage, mintTestToken, distributeTokens } = createExecutableFunctions(EscrowContract);
    // Only expose specified methods
    return {
        init: init,
        createEscrow: createEscrow,
        completeEscrow: completeEscrow,
        disputeEscrow: disputeEscrow,
        resolveDispute: resolveDispute,
        cancelEscrow: cancelEscrow,
        updateFeePercentage: updateFeePercentage,
        mintTestToken: mintTestToken,
        distributeTokens: distributeTokens
    };
});
// Create function wrappers that forward calls to exposed methods
function init(...args) { return exposed().init(...args); }
function createEscrow(...args) { return exposed().createEscrow(...args); }
function completeEscrow(...args) { return exposed().completeEscrow(...args); }
function disputeEscrow(...args) { return exposed().disputeEscrow(...args); }
function resolveDispute(...args) { return exposed().resolveDispute(...args); }
function cancelEscrow(...args) { return exposed().cancelEscrow(...args); }
function updateFeePercentage(...args) { return exposed().updateFeePercentage(...args); }
function mintTestToken(...args) { return exposed().mintTestToken(...args); }
function distributeTokens(...args) { return exposed().distributeTokens(...args); }
