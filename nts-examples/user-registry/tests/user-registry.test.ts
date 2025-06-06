import { NAppClient } from "@n1xyz/nts-sdk";
import { ContractIDL } from "../build/idl";

export default async function ({ client }: { client: NAppClient<ContractIDL> }) {
  console.log('🧪 Testing User Registry...\n');
  
  // Initialize the app
  try {
    await client.actions.init();
    console.log('✅ User registry initialized');
  } catch (error) {
    console.error('❌ Failed to initialize user registry:', error);
    throw error;
  }
  
  // Register a user
  try {
    await client.actions.register('Alice', 'alice@example.com');
    console.log('✅ User Alice registered');
  } catch (error) {
    console.error('❌ Failed to register user Alice:', error);
    throw error;
  }
  
  // Update profile
  try {
    await client.actions.updateProfile('Alice Updated', 'alice.updated@example.com');
    console.log('✅ Profile updated');
  } catch (error) {
    console.error('❌ Failed to update profile:', error);
    throw error;
  }
  
  // Check user count
  try {
    const userCount = await client.state.userCount();
    console.log(`📊 Total users: ${userCount}`);
  } catch (error) {
    console.error('❌ Failed to get user count:', error);
    throw error;
  }
  
  // Test error handling - this should fail due to empty email
  try {
    await client.actions.register('Bob', ''); // Should fail - empty email
    console.error('❌ Should have failed for empty email but succeeded');
    throw new Error('Expected registration to fail for empty email, but it succeeded');
  } catch (error) {
    console.log('✅ Correctly caught error:', error);
  }
  
  console.log('\n🎉 User Registry test completed!');
}
