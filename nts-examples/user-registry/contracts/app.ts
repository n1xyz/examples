import { NApp, NMap, createExecutableFunctions } from '@n1xyz/nts-compiler';

interface UserProfile {
  name: string;
  email: string;
  registeredAt: number;
  active: boolean;
}

class UserRegistry extends NApp {
  users: NMap<UserProfile> = new NMap<UserProfile>(this, 'users');
  userCount: number;

  init(): void {
    this.log('Initializing UserRegistry app');
    this.userCount = 0;
    this.log('UserRegistry initialized successfully', {
      userCount: this.userCount,
      timestamp: this.time()
    });
  }

  register(name: string, email: string): void {
    const userId = this.signer();
    this.log('User registration attempt started', {
      userId,
      name,
      email,
      timestamp: this.time()
    });
    
    // Check if user already exists
    this.log('Checking if user already exists for userId:', userId);
    const existingUser = this.users.get(userId);
    if (existingUser) {
      this.log('ERROR: User registration failed - user already exists', {
        userId,
        existingUser,
        attemptedName: name,
        attemptedEmail: email
      });
      throw new Error('User already registered');
    }
    this.log('User existence check passed - user does not exist yet');

    // Validate input
    this.log('Starting input validation', { name, email });
    
    if (!name) {
      this.log('ERROR: Registration failed - name is empty or null', {
        userId,
        providedName: name,
        email
      });
      throw new Error('Name and email are required');
    }
    
    if (!email) {
      this.log('ERROR: Registration failed - email is empty or null', {
        userId,
        name,
        providedEmail: email
      });
      throw new Error('Name and email are required');
    }
    
    if (name.trim().length === 0) {
      this.log('ERROR: Registration failed - name is only whitespace', {
        userId,
        name,
        email
      });
      throw new Error('Name cannot be empty or only whitespace');
    }
    
    if (email.trim().length === 0) {
      this.log('ERROR: Registration failed - email is only whitespace', {
        userId,
        name,
        email
      });
      throw new Error('Email cannot be empty or only whitespace');
    }
    
    if (!email.includes('@')) {
      this.log('ERROR: Registration failed - invalid email format', {
        userId,
        name,
        email,
        reason: 'Email must contain @ symbol'
      });
      throw new Error('Invalid email format');
    }
    
    this.log('Input validation passed successfully');

    const profile: UserProfile = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      registeredAt: this.time(),
      active: true
    };

    this.log('Creating user profile', {
      userId,
      profile,
      previousUserCount: this.userCount
    });

    this.users.set(userId, profile, 'user_registration', userId);
    this.userCount++;

    this.log('User registered successfully', { 
      userId, 
      name: profile.name, 
      email: profile.email,
      newUserCount: this.userCount,
      registrationTime: profile.registeredAt
    });
  }

  updateProfile(name?: string, email?: string): void {
    const userId = this.signer();
    this.log('Profile update attempt started', {
      userId,
      newName: name,
      newEmail: email,
      timestamp: this.time()
    });

    this.log('Fetching existing user profile for userId:', userId);
    const profile = this.users.get(userId);

    if (!profile) {
      this.log('ERROR: Profile update failed - user not found', {
        userId,
        attemptedName: name,
        attemptedEmail: email
      });
      throw new Error('User not found');
    }
    
    this.log('Existing profile found', {
      userId,
      currentProfile: profile
    });

    const originalProfile = { ...profile };
    let hasChanges = false;

    if (name !== undefined) {
      this.log('Validating new name', { oldName: profile.name, newName: name });
      
      if (!name || name.trim().length === 0) {
        this.log('ERROR: Profile update failed - invalid name provided', {
          userId,
          providedName: name,
          currentName: profile.name
        });
        throw new Error('Name cannot be empty or only whitespace');
      }
      
      const trimmedName = name.trim();
      if (trimmedName !== profile.name) {
        profile.name = trimmedName;
        hasChanges = true;
        this.log('Name will be updated', {
          oldName: originalProfile.name,
          newName: trimmedName
        });
      } else {
        this.log('Name unchanged - same as current name');
      }
    }

    if (email !== undefined) {
      this.log('Validating new email', { oldEmail: profile.email, newEmail: email });
      
      if (!email || email.trim().length === 0) {
        this.log('ERROR: Profile update failed - invalid email provided', {
          userId,
          providedEmail: email,
          currentEmail: profile.email
        });
        throw new Error('Email cannot be empty or only whitespace');
      }
      
      if (!email.includes('@')) {
        this.log('ERROR: Profile update failed - invalid email format', {
          userId,
          providedEmail: email,
          currentEmail: profile.email,
          reason: 'Email must contain @ symbol'
        });
        throw new Error('Invalid email format');
      }
      
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail !== profile.email) {
        profile.email = trimmedEmail;
        hasChanges = true;
        this.log('Email will be updated', {
          oldEmail: originalProfile.email,
          newEmail: trimmedEmail
        });
      } else {
        this.log('Email unchanged - same as current email');
      }
    }

    if (!hasChanges) {
      this.log('No changes detected - profile update skipped', {
        userId,
        providedName: name,
        providedEmail: email,
        currentProfile: originalProfile
      });
      return;
    }

    this.log('Saving updated profile', {
      userId,
      originalProfile,
      updatedProfile: profile,
      changesDetected: hasChanges
    });

    this.users.set(userId, profile, 'user_update', userId);
    
    this.log('Profile updated successfully', { 
      userId, 
      originalProfile,
      updatedProfile: profile,
      updateTime: this.time()
    });
  }

  deactivate(): void {
    const userId = this.signer();
    this.log('User deactivation attempt started', {
      userId,
      timestamp: this.time()
    });

    this.log('Fetching user profile for deactivation, userId:', userId);
    const profile = this.users.get(userId);

    if (!profile) {
      this.log('ERROR: Deactivation failed - user not found', {
        userId
      });
      throw new Error('User not found');
    }

    this.log('User profile found for deactivation', {
      userId,
      currentProfile: profile,
      currentlyActive: profile.active
    });

    if (!profile.active) {
      this.log('WARNING: User is already deactivated', {
        userId,
        profile,
        deactivatedSince: profile.registeredAt
      });
    }

    const originalStatus = profile.active;
    profile.active = false;

    this.log('Setting user status to inactive', {
      userId,
      originalStatus,
      newStatus: profile.active
    });

    this.users.set(userId, profile, 'user_deactivation', userId);
    
    this.log('User deactivated successfully', { 
      userId,
      profile,
      deactivationTime: this.time(),
      wasActive: originalStatus
    });
  }
}

export const { 
  init,
  register, 
  updateProfile, 
  deactivate
} = createExecutableFunctions(UserRegistry);
