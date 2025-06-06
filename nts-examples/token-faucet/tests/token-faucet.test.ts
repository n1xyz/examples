import { NAppClient } from "@n1xyz/nts-sdk";
import { ContractIDL } from "../build/idl";

export default async function ({ client }: { client: NAppClient<ContractIDL> }) {
  console.log('🧪 Testing Token Faucet...\n');
  
  // Initialize the app
  try {
    await client.actions.init();
    console.log('✅ Token faucet initialized');
  } catch (error) {
    console.error('❌ Failed to initialize token faucet:', error);
    throw error;
  }
  
  // Setup faucet (admin action) - this now creates and sets the token automatically
  try {
    await client.actions.setupFaucet('1000000000000000000000000'); // 1M tokens
    console.log('✅ Faucet setup completed with token creation');
  } catch (error) {
    console.error('❌ Failed to setup faucet:', error);
    throw error;
  }
  
  // Test claiming tokens
  try {
    await client.actions.claim();
    console.log('✅ Tokens claimed successfully');
  } catch (error) {
    console.error('❌ Failed to claim tokens:', error);
    throw error;
  }
  
  // Check state
  try {
    const isInitialized = await client.state.isInitialized();
    const totalClaimed = await client.state.totalClaimed();
    const claimAmount = await client.state.claimAmount();
    const faucetToken = await client.state.faucetToken();
    
    console.log(`📊 Faucet Status:`);
    console.log(`   - Initialized: ${isInitialized}`);
    console.log(`   - Total Claimed: ${totalClaimed}`);
    console.log(`   - Claim Amount: ${claimAmount}`);
    console.log(`   - Faucet Token: ${faucetToken}`);
  } catch (error) {
    console.error('❌ Failed to read faucet state:', error);
    throw error;
  }
  
  // Test admin functions
  try {
    await client.actions.updateClaimAmount('2000000000000000000'); // 2 tokens
    console.log('✅ Claim amount updated');
  } catch (error) {
    console.error('❌ Failed to update claim amount:', error);
    throw error;
  }
  
  try {
    await client.actions.updateCooldown(1800); // 30 minutes
    console.log('✅ Cooldown updated');
  } catch (error) {
    console.error('❌ Failed to update cooldown:', error);
    throw error;
  }
  
  // Test error handling - this should fail due to cooldown
  try {
    await client.actions.claim(); // Should fail due to cooldown
    console.error('❌ Should have failed due to cooldown but succeeded');
    throw new Error('Expected claim to fail due to cooldown, but it succeeded');
  } catch (error) {
    console.log('✅ Correctly caught cooldown error:', error);
  }
  
  console.log('\n🎉 Token Faucet test completed!');
}
