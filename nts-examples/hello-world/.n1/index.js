const exposed = (()=>{
    const nread = global.IRC.nread;
    const nwrite = global.IRC.nwrite;
    const nsend = global.IRC.nsend;
    const nsendToCluster = global.IRC.nsendToCluster;
    const nmint = global.IRC.nmint;
    const nmintEdit = global.IRC.nmintEdit;
    const _signer = global.IRC.signer;
    const log = global.log;
    function _getBalance(mint, address) {
        if (!mint || typeof mint !== "string") throw new Error("Invalid mint address");
        if (!address || typeof address !== "string") throw new Error("Invalid user address");
        if (mint.trim() === "") throw new Error("Mint address cannot be empty");
        if (address.trim() === "") throw new Error("User address cannot be empty");
        const fieldId = "user_balance_" + mint + "_" + address;
        const fv = nread(fieldId);
        return BigInt(fv ? fv : 0);
    }
    function __deposit(amount, mint, args) {
        if (!mint || typeof mint !== "string") throw new Error("Invalid mint address");
        if (!args) throw new Error("Invalid arguments");
        let receiver;
        try {
            const parsed = JSON.parse(args);
            receiver = parsed.receiver;
        } catch (e) {
            throw new Error("Invalid JSON arguments");
        }
        if (!receiver || typeof receiver !== "string") {
            throw new Error("Invalid receiver address");
        }
        if (receiver.trim() === "") {
            throw new Error("Receiver address cannot be empty");
        }
        if (amount < 0n) {
            throw new Error("Amount must be positive");
        }
        const maxSafeValue = BigInt("18446744073709551615"); // 2^64-1
        if (amount > maxSafeValue) {
            throw new Error("Amount exceeds maximum safe value");
        }
        const prevAmount = _getBalance(mint, receiver);
        // Check for overflow
        if (prevAmount + amount < prevAmount || prevAmount + amount > maxSafeValue) {
            throw new Error("Balance overflow detected");
        }
        nwrite("user_balance_" + mint + "_" + receiver, (prevAmount + amount).toString(), "user_balance_" + receiver);
        log("Deposit successful: " + amount.toString() + " tokens to " + receiver);
    }
    function _withdraw(amount, mint, destinationAppId, receiverOpt, senderOpt) {
        if (!destinationAppId || typeof destinationAppId !== 'string') {
            throw new Error("Invalid destination app ID");
        }
        const receiver = receiverOpt ? receiverOpt : _signer;
        const sender = senderOpt ? senderOpt : _signer;
        if (!receiver || typeof receiver !== 'string') throw new Error("Invalid receiver address");
        if (!sender || typeof sender !== 'string') throw new Error("Invalid sender address");
        const prevAmount = _getBalance(mint, sender);
        const withdrawalAmount = amount;
        if (withdrawalAmount <= 0n) {
            throw new Error("Withdrawal amount must be positive");
        }
        if (withdrawalAmount > prevAmount) {
            throw new Error("Insufficient funds: requested " + withdrawalAmount.toString() + ", available " + prevAmount.toString());
        }
        nwrite("user_balance_" + mint + "_" + sender, (prevAmount - withdrawalAmount).toString(), "user_balance_" + sender);
        nsend(destinationAppId, mint, withdrawalAmount.toString(), {
            receiver
        });
        log("Withdrawal successful: " + withdrawalAmount.toString() + " tokens from " + sender + " to app " + destinationAppId);
    }
    function _withdrawToCluster(amount, mint, destinationClusterId, receiverOpt, senderOpt) {
        if (!destinationClusterId || typeof destinationClusterId !== "string") {
            throw new Error("Invalid destination cluster ID");
        }
        if (!mint || typeof mint !== "string") {
            throw new Error("Invalid mint address");
        }
        const receiver = receiverOpt ? receiverOpt : _signer;
        const sender = senderOpt ? senderOpt : _signer;
        if (!receiver || typeof receiver !== "string") throw new Error("Invalid receiver address");
        if (!sender || typeof sender !== "string") throw new Error("Invalid sender address");
        const prevAmount = _getBalance(mint, sender);
        const withdrawalAmount = amount;
        if (withdrawalAmount > prevAmount) {
            throw new Error("Insufficient funds: requested " + withdrawalAmount.toString() + ", available " + prevAmount.toString());
        }
        if (withdrawalAmount <= 0n) {
            throw new Error("Withdrawal amount must be positive");
        }
        nwrite("user_balance_" + mint + "_" + sender, (prevAmount - withdrawalAmount).toString(), "user_balance_" + sender);
        nsendToCluster(destinationClusterId, mint, withdrawalAmount.toString(), {
            receiver
        });
        log("Cluster withdrawal successful: " + withdrawalAmount.toString() + " tokens from " + sender + " to cluster " + destinationClusterId);
    }
    function _mintTransfer(amount, mint, destination) {
        const mintAdmin = nread("_mint_admin_" + mint);
        if (mintAdmin !== _signer) {
            throw new Error("Invalid mint admin!");
        }
        const adminBalance = BigInt(nread("admin_balance_" + mint) || 0);
        if (adminBalance < amount) {
            throw new Error("Insufficient admin funds for transfer!");
        }
        if (amount <= 0) {
            throw new Error("Negative transfer amount!");
        }
        __deposit(amount, mint, JSON.stringify({
            receiver: destination
        }));
        nwrite("admin_balance_" + mint, (adminBalance - amount).toString());
        log("Mint transfer successful: " + amount.toString() + " tokens to " + destination);
    }
    function _mint(totalSupply, admin, meta) {
        if (!admin || typeof admin !== 'string') throw new Error("Invalid admin address");
        if (totalSupply <= 0n) throw new Error("Total supply must be positive");
        if (!meta) throw new Error("Metadata is required");
        const mint = nmint(totalSupply.toString(), admin, meta);
        nwrite("admin_balance_" + mint, totalSupply.toString());
        log("New token minted: " + totalSupply.toString() + " tokens with admin " + admin);
        return mint;
    }
    function _transfer(amount, mint, receiver, senderOpt) {
        if (!mint || typeof mint !== 'string') throw new Error("Invalid mint address");
        if (!receiver || typeof receiver !== 'string') throw new Error("Invalid receiver address");
        const sender = senderOpt ? senderOpt : _signer;
        if (!sender || typeof sender !== 'string') throw new Error("Invalid sender address");
        if (sender === receiver) {
            throw new Error("Self-transfers are not allowed");
        }
        if (amount <= 0n) {
            throw new Error("Transfer amount must be positive");
        }
        const senderBalance = _getBalance(mint, sender);
        if (amount > senderBalance) {
            throw new Error("Insufficient funds: requested " + amount.toString() + ", available " + senderBalance.toString());
        }
        const receiverBalance = _getBalance(mint, receiver);
        // Check for overflow
        if (receiverBalance + amount < receiverBalance) {
            throw new Error("Balance overflow detected");
        }
        nwrite("user_balance_" + mint + "_" + sender, (senderBalance - amount).toString(), "user_balance_" + sender);
        nwrite("user_balance_" + mint + "_" + receiver, (receiverBalance + amount).toString(), "user_balance_" + receiver);
        log("Transfer successful: " + amount.toString() + " tokens from " + sender + " to " + receiver);
    }
    function _getMintAdmin(mint) {
        return nread("_mint_admin_" + mint);
    }
    function _getAdminSupply(mint) {
        return BigInt(nread("admin_balance_" + mint) || 0n);
    }
    function _deposit(amount, mint, args) {
        __deposit(BigInt(amount), mint, args);
    }
    // exposed functions:
    function withdraw(amount, mint, destinationAppId, receiverOpt) {
        _withdraw(BigInt(amount), mint, destinationAppId, receiverOpt);
    }
    function withdrawToCluster(amount, mint, destinationClusterId, receiverOpt) {
        _withdrawToCluster(BigInt(amount), mint, destinationClusterId, receiverOpt);
    }
    function mintTransfer(amount, mint, destination) {
        _mintTransfer(BigInt(amount), mint, destination);
    }
    function mint(totalSupply, admin, meta) {
        _mint(BigInt(totalSupply), admin, meta);
    }
    function transfer(amount, mint, receiver) {
        _transfer(BigInt(amount), mint, receiver);
    }
    class NMap {
        data = new Map();
        prefix;
        parent;
        constructor(parent, prefix){
            this.parent = parent;
            this.prefix = prefix;
        }
        get(key) {
            if (this.data.has(key)) {
                return this.data.get(key);
            }
            const value = this.parent.kvRead(`${this.parent.appId}:${this.prefix}:${key}`);
            if (value !== undefined) {
                this.data.set(key, value);
            }
            return value;
        }
        set(key, value, tag) {
            this.data.set(key, value);
            this.parent.addPendingChange(`${this.prefix}:${key}`, value, tag || this.prefix);
        }
        delete(key, tag) {
            this.data.delete(key);
            this.parent.addPendingChange(`${this.prefix}:${key}`, undefined, tag || this.prefix);
        }
        has(key) {
            return this.data.has(key) || this.parent.kvRead(`${this.parent.appId}:${this.prefix}:${key}`) !== undefined;
        }
        clear(tag) {
            for (const key of this.data.keys()){
                this.delete(key, tag || this.prefix);
            }
        }
        keys() {
            return Array.from(this.data.keys());
        }
        values() {
            return Array.from(this.data.values());
        }
        entries() {
            return Array.from(this.data.entries());
        }
    }
    class NApp {
        initialized = false;
        pendingChanges = new Map();
        appId;
        caller;
        constructor(appId){
            this.appId = appId;
        }
        addPendingChange(key, value, tag) {
            this.pendingChanges.set(key, {
                value,
                tag
            });
        }
        kvRead(key) {
            throw new Error('kvRead not implemented');
        }
        kvWrite(key, value, tag) {
            throw new Error('kvWrite not implemented');
        }
        init() {
            if (this.initialized) {
                throw new Error('App already initialized');
            }
            this.initialized = true;
        }
        fieldProxy() {
            return {
                set: (target, prop, value)=>{
                    this.checkInitialized();
                    if (typeof prop === 'string' && !prop.startsWith('_')) {
                        this.pendingChanges.set(prop, {
                            value
                        });
                    }
                    target[prop] = value;
                    return true;
                },
                get: (target, prop)=>{
                    if (typeof target[prop] === 'function' && prop !== 'init') {
                        this.checkInitialized();
                    }
                    if (typeof prop === 'string' && !prop.startsWith('_')) {
                        if (this.pendingChanges.has(prop)) {
                            const change = this.pendingChanges.get(prop);
                            if (change) {
                                target[prop] = change.value;
                                return change.value;
                            }
                        }
                        const value = this.kvRead(`${this.appId}:${prop}`);
                        if (value !== undefined) {
                            target[prop] = value;
                        }
                    }
                    return target[prop];
                }
            };
        }
        static wrapMethod(target, methodName, appId) {
            return function(...args) {
                const app = new target(appId);
                app.init();
                const proxiedApp = new Proxy(app, app.fieldProxy());
                const result = proxiedApp[methodName].apply(proxiedApp, args);
                app.recordChanges();
                return result;
            };
        }
        recordChanges() {
            for (const [prop, { value, tag }] of this.pendingChanges.entries()){
                this.kvWrite(`${this.appId}:${prop}`, value, tag);
            }
            this.pendingChanges.clear();
        }
        checkInitialized() {
            if (!this.initialized) {
                throw new Error('App not initialized');
            }
        }
        static injectKVMethods(nread, nwrite) {
            this.prototype.kvRead = nread;
            this.prototype.kvWrite = nwrite;
        }
    }
    function createWrappers(AppClass, appId) {
        const prototype = AppClass.prototype;
        const wrappers = {};
        // Get all method names from the prototype
        const methodNames = Object.getOwnPropertyNames(prototype).filter((name)=>typeof prototype[name] === 'function' && name !== 'constructor');
        // Create wrappers for methods with decorators
        for (const methodName of methodNames){
            wrappers[methodName] = NApp.wrapMethod(AppClass, methodName, appId);
        }
        return wrappers;
    }
    // Helper to create all wrappers
    function createExecutableFunctions(AppClass, appId) {
        return createWrappers(AppClass, appId);
    }
    NApp.injectKVMethods((key)=>console.log("maaaaaaa"), (key, value, tag)=>console.log("moooooo"));
    ;
    class HelloWorld extends NApp {
        constructor(){
            super("helloworld");
        }
        hello() {
            console.log("hello world");
        }
    }
    const { hello } = createExecutableFunctions(HelloWorld, "helloworld");
    // Only expose specified methods
    return {
        hello
    };
})();
// Export only the exposed methods
Object.assign(globalThis, exposed);
