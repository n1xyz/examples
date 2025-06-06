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
    class UserRegistry extends NApp {
        constructor() {
            super(...arguments);
            this.users = new NMap(this, "users");
        }
        init() {
            this.log("Initializing UserRegistry app");
            this.userCount = 0;
            this.log("UserRegistry initialized successfully", {
                userCount: this.userCount,
                timestamp: this.time()
            });
        }
        register(name, email) {
            const userId = this.signer();
            this.log("User registration attempt started", {
                userId,
                name,
                email,
                timestamp: this.time()
            });
            // Check if user already exists
            this.log("Checking if user already exists for userId:", userId);
            const existingUser = this.users.get(userId);
            if (existingUser) {
                this.log("ERROR: User registration failed - user already exists", {
                    userId,
                    existingUser,
                    attemptedName: name,
                    attemptedEmail: email
                });
                throw new Error("User already registered");
            }
            this.log("User existence check passed - user does not exist yet");
            // Validate input
            this.log("Starting input validation", { name, email });
            if (!name) {
                this.log("ERROR: Registration failed - name is empty or null", {
                    userId,
                    providedName: name,
                    email
                });
                throw new Error("Name and email are required");
            }
            if (!email) {
                this.log("ERROR: Registration failed - email is empty or null", {
                    userId,
                    name,
                    providedEmail: email
                });
                throw new Error("Name and email are required");
            }
            if (name.trim().length === 0) {
                this.log("ERROR: Registration failed - name is only whitespace", {
                    userId,
                    name,
                    email
                });
                throw new Error("Name cannot be empty or only whitespace");
            }
            if (email.trim().length === 0) {
                this.log("ERROR: Registration failed - email is only whitespace", {
                    userId,
                    name,
                    email
                });
                throw new Error("Email cannot be empty or only whitespace");
            }
            if (!email.includes("@")) {
                this.log("ERROR: Registration failed - invalid email format", {
                    userId,
                    name,
                    email,
                    reason: "Email must contain @ symbol"
                });
                throw new Error("Invalid email format");
            }
            this.log("Input validation passed successfully");
            const profile = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                registeredAt: this.time(),
                active: true
            };
            this.log("Creating user profile", {
                userId,
                profile,
                previousUserCount: this.userCount
            });
            this.users.set(userId, profile, "user_registration", userId);
            this.userCount++;
            this.log("User registered successfully", {
                userId,
                name: profile.name,
                email: profile.email,
                newUserCount: this.userCount,
                registrationTime: profile.registeredAt
            });
        }
        updateProfile(name, email) {
            const userId = this.signer();
            this.log("Profile update attempt started", {
                userId,
                newName: name,
                newEmail: email,
                timestamp: this.time()
            });
            this.log("Fetching existing user profile for userId:", userId);
            const profile = this.users.get(userId);
            if (!profile) {
                this.log("ERROR: Profile update failed - user not found", {
                    userId,
                    attemptedName: name,
                    attemptedEmail: email
                });
                throw new Error("User not found");
            }
            this.log("Existing profile found", {
                userId,
                currentProfile: profile
            });
            const originalProfile = Object.assign({}, profile);
            let hasChanges = false;
            if (name !== undefined) {
                this.log("Validating new name", { oldName: profile.name, newName: name });
                if (!name || name.trim().length === 0) {
                    this.log("ERROR: Profile update failed - invalid name provided", {
                        userId,
                        providedName: name,
                        currentName: profile.name
                    });
                    throw new Error("Name cannot be empty or only whitespace");
                }
                const trimmedName = name.trim();
                if (trimmedName !== profile.name) {
                    profile.name = trimmedName;
                    hasChanges = true;
                    this.log("Name will be updated", {
                        oldName: originalProfile.name,
                        newName: trimmedName
                    });
                }
                else {
                    this.log("Name unchanged - same as current name");
                }
            }
            if (email !== undefined) {
                this.log("Validating new email", { oldEmail: profile.email, newEmail: email });
                if (!email || email.trim().length === 0) {
                    this.log("ERROR: Profile update failed - invalid email provided", {
                        userId,
                        providedEmail: email,
                        currentEmail: profile.email
                    });
                    throw new Error("Email cannot be empty or only whitespace");
                }
                if (!email.includes("@")) {
                    this.log("ERROR: Profile update failed - invalid email format", {
                        userId,
                        providedEmail: email,
                        currentEmail: profile.email,
                        reason: "Email must contain @ symbol"
                    });
                    throw new Error("Invalid email format");
                }
                const trimmedEmail = email.trim().toLowerCase();
                if (trimmedEmail !== profile.email) {
                    profile.email = trimmedEmail;
                    hasChanges = true;
                    this.log("Email will be updated", {
                        oldEmail: originalProfile.email,
                        newEmail: trimmedEmail
                    });
                }
                else {
                    this.log("Email unchanged - same as current email");
                }
            }
            if (!hasChanges) {
                this.log("No changes detected - profile update skipped", {
                    userId,
                    providedName: name,
                    providedEmail: email,
                    currentProfile: originalProfile
                });
                return;
            }
            this.log("Saving updated profile", {
                userId,
                originalProfile,
                updatedProfile: profile,
                changesDetected: hasChanges
            });
            this.users.set(userId, profile, "user_update", userId);
            this.log("Profile updated successfully", {
                userId,
                originalProfile,
                updatedProfile: profile,
                updateTime: this.time()
            });
        }
        deactivate() {
            const userId = this.signer();
            this.log("User deactivation attempt started", {
                userId,
                timestamp: this.time()
            });
            this.log("Fetching user profile for deactivation, userId:", userId);
            const profile = this.users.get(userId);
            if (!profile) {
                this.log("ERROR: Deactivation failed - user not found", {
                    userId
                });
                throw new Error("User not found");
            }
            this.log("User profile found for deactivation", {
                userId,
                currentProfile: profile,
                currentlyActive: profile.active
            });
            if (!profile.active) {
                this.log("WARNING: User is already deactivated", {
                    userId,
                    profile,
                    deactivatedSince: profile.registeredAt
                });
            }
            const originalStatus = profile.active;
            profile.active = false;
            this.log("Setting user status to inactive", {
                userId,
                originalStatus,
                newStatus: profile.active
            });
            this.users.set(userId, profile, "user_deactivation", userId);
            this.log("User deactivated successfully", {
                userId,
                profile,
                deactivationTime: this.time(),
                wasActive: originalStatus
            });
        }
    }
    const { init, register, updateProfile, deactivate } = createExecutableFunctions(UserRegistry);
    // Only expose specified methods
    return {
        init: init,
        register: register,
        updateProfile: updateProfile,
        deactivate: deactivate
    };
});
// Create function wrappers that forward calls to exposed methods
function init(...args) { return exposed().init(...args); }
function register(...args) { return exposed().register(...args); }
function updateProfile(...args) { return exposed().updateProfile(...args); }
function deactivate(...args) { return exposed().deactivate(...args); }
