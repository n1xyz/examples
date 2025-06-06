import { NAppClient } from "@n1xyz/nts-sdk";
import { ContractIDL } from "../build/idl";

export default async function ({ client }: { client: NAppClient<ContractIDL> }) {
  console.log('🧪 Testing Counter...\n');
  
  // Initialize the app
  await client.actions.init();
  console.log('✅ Counter initialized');
  
  // Test increment
  await client.actions.increment(2);
  console.log('✅ Incremented by 2');
  
  // Check current count
  const count1 = await client.state.count();
  console.log(`📊 Current count: ${count1}`);
  
  // Test increment with default value
  await client.actions.increment(1);
  console.log('✅ Incremented by 1 (default)');
  
  // Test decrement
  await client.actions.decrement(1);
  console.log('✅ Decremented by 1');
  
  // Check final count
  const finalCount = await client.state.count();
  console.log(`📊 Final count: ${finalCount}`);
  
  // Test multiple operations
  await client.actions.increment(5);
  await client.actions.decrement(2);
  
  const endCount = await client.state.count();
  console.log(`📊 End count after +5-2: ${endCount}`);
  
  console.log('\n🎉 Counter test completed!');
}
