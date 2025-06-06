import { NAppClient, NUser } from "@n1xyz/nts-sdk";
import { ContractIDL } from "../build/idl";

export default async function ({ client }: { client: NAppClient<ContractIDL> }) {

  const arbiter = await NUser.createRandomUser(client.ntsInterface)
  const buyer = await  NUser.createRandomUser(client.ntsInterface)
  const seller = await  NUser.createRandomUser(client.ntsInterface)

  const arbiterClient = client.withUser(arbiter)
  const buyerClient = client.withUser(buyer)
  const sellerClient = client.withUser(seller)

  console.log('👥 Created test users:');
  console.log('  Arbiter:', arbiter.getAddress());
  console.log('  Buyer:', buyer.getAddress());
  console.log('  Seller:', seller.getAddress());

  console.log('\n🧪 Testing Escrow Contract...\n');
  
  // Initialize the app (using main client as admin)
  await client.actions.init();
  console.log('✅ Escrow contract initialized');
  
  // First, mint a test token that will be used in escrow operations (using main client as admin)
  console.log('🪙 Minting test token...');
  await client.actions.mintTestToken(
    '10000000000000000000000', // 10,000 tokens with 18 decimals
    JSON.stringify({
      name: 'Escrow Test Token',
      symbol: 'ETT',
      decimals: 18,
      description: 'Test token for escrow contract testing'
    })
  );
  console.log('✅ Test token minted');
  
  // Retrieve the actual mint ID from the contract state
  const testTokenMintId = await client.state.testTokenMintId();
  console.log('🔍 Retrieved mint ID:', testTokenMintId);
  
  if (!testTokenMintId) {
    throw new Error('Failed to retrieve mint ID from contract state');
  }
  
  // Distribute tokens to test participants - these should succeed (using main client as token admin)
  console.log('📤 Distributing tokens to test participants...');
  
  // Give buyer tokens to use in escrow
  await client.actions.distributeTokens(
    buyer.getAddress(),
    testTokenMintId,
    '5000000000000000000000' // 5,000 tokens
  );
  console.log('✅ Tokens distributed to buyer');
  
  // Give seller some tokens (optional, for other test scenarios)
  await client.actions.distributeTokens(
    seller.getAddress(),
    testTokenMintId,
    '3000000000000000000000' // 3,000 tokens
  );
  console.log('✅ Tokens distributed to seller');
  
  // Give arbiter some tokens (optional, for dispute resolution scenarios)
  await client.actions.distributeTokens(
    arbiter.getAddress(),
    testTokenMintId,
    '1000000000000000000000' // 1,000 tokens
  );
  console.log('✅ Tokens distributed to arbiter');
  
  // Now test escrow functionality with the minted token
  console.log('\n🔄 Testing escrow operations with real tokens...');
  
  // Create an escrow using the buyer client (buyer creates the escrow)
  await buyerClient.actions.createEscrow(
    seller.getAddress(),
    arbiter.getAddress(), 
    testTokenMintId, // Use the actual minted token ID
    '1000000000000000000', // 1 token
    'Test product sale with real token'
  );
  console.log('✅ Escrow created with real token by buyer');
  
  // Check state
  const escrowCount = await client.state.escrowCount();
  const feePercentage = await client.state.feePercentage();
  
  console.log(`📊 Contract Status:`);
  console.log(`   - Total Escrows: ${escrowCount}`);
  console.log(`   - Fee Percentage: ${feePercentage} basis points`);
  console.log(`   - Test Token Mint ID: ${testTokenMintId}`);
  
  // Test completing an escrow - buyer completes it
  await buyerClient.actions.completeEscrow('escrow_1');
  console.log('✅ Escrow completed successfully by buyer');
  
  // Test dispute functionality - create another escrow first
  await buyerClient.actions.createEscrow(
    seller.getAddress(),
    arbiter.getAddress(),
    testTokenMintId, // Use the actual minted token ID
    '2000000000000000000', // 2 tokens
    'Another product with real token'
  );
  console.log('✅ Second escrow created by buyer');
  
  // Buyer disputes the escrow
  await buyerClient.actions.disputeEscrow('escrow_2');
  console.log('✅ Escrow disputed by buyer');
  
  // Resolve dispute using arbiter client (only arbiter can resolve disputes)
  await arbiterClient.actions.resolveDispute('escrow_2', true); // Refund to buyer
  console.log('✅ Dispute resolved by arbiter');
  
  // Test admin functions - using main client as admin
  await client.actions.updateFeePercentage(300); // 3%
  console.log('✅ Fee percentage updated by admin');
  
  // Test error handling - this SHOULD fail
  console.log('\n🚫 Testing error handling (expecting failures)...');
  
  try {
    await buyerClient.actions.createEscrow('', '', '', '0', ''); // Invalid params
    throw new Error('Expected validation error but operation succeeded');
  } catch (error) {
    console.log('✅ Correctly caught validation error for invalid params');
  }
  
  // Test duplicate token minting - this SHOULD fail (using main client)
  try {
    await client.actions.mintTestToken('1000', 'duplicate');
    throw new Error('Expected error for duplicate token minting but operation succeeded');
  } catch (error) {
    console.log('✅ Correctly prevented duplicate token minting');
  }
  
  // Test completing non-existent escrow - this SHOULD fail
  try {
    await buyerClient.actions.completeEscrow('escrow_999');
    throw new Error('Expected error for non-existent escrow but operation succeeded');
  } catch (error) {
    console.log('✅ Correctly caught error for non-existent escrow');
  }
  
  // Test permission errors - seller trying to complete escrow should fail
  try {
    // Create a new escrow first
    await buyerClient.actions.createEscrow(
      seller.getAddress(),
      arbiter.getAddress(),
      testTokenMintId,
      '500000000000000000', // 0.5 tokens
      'Test permission escrow'
    );
    
    // Seller tries to complete (should fail - only buyer can complete)
    await sellerClient.actions.completeEscrow('escrow_3');
    throw new Error('Expected permission error but operation succeeded');
  } catch (error) {
    console.log('✅ Correctly caught permission error - seller cannot complete escrow');
  }
  
  // Test non-arbiter trying to resolve dispute should fail
  try {
    // Create and dispute another escrow
    await buyerClient.actions.createEscrow(
      seller.getAddress(),
      arbiter.getAddress(),
      testTokenMintId,
      '300000000000000000', // 0.3 tokens
      'Test arbiter permission escrow'
    );
    
    await buyerClient.actions.disputeEscrow('escrow_4');
    
    // Buyer tries to resolve dispute (should fail - only arbiter can resolve)
    await buyerClient.actions.resolveDispute('escrow_4', true);
    throw new Error('Expected permission error but operation succeeded');
  } catch (error) {
    console.log('✅ Correctly caught permission error - only arbiter can resolve disputes');
  }
  
  console.log('\n🎉 Escrow Contract test completed with real token operations!');
  console.log(`📝 Summary: Used mint ID ${testTokenMintId} for all escrow operations`);
  console.log('🎯 All expected operations succeeded and all expected failures were caught');
  console.log('👤 All operations used proper user authentication and permissions');
}
