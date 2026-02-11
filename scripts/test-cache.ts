import { cacheManager } from '../lib/cache/CacheManager';

async function testCache() {
  console.log('--- Starting CacheManager Tests ---');

  // Test 1: Basic Set and Get
  console.log('\nTest 1: Basic Set and Get');
  const testKey = 'user_123';
  const testData = { name: 'Alice', level: 5 };
  
  await cacheManager.set(testKey, testData);
  const retrieved = await cacheManager.get(testKey);
  
  if (JSON.stringify(retrieved) === JSON.stringify(testData)) {
    console.log('✅ Success: Data retrieved matches set data');
  } else {
    console.error('❌ Failure: Data mismatch', retrieved);
  }

  // Test 2: Expiration
  console.log('\nTest 2: Expiration');
  const shortLivedKey = 'temp_token';
  // Set maxAge to 100ms
  await cacheManager.set(shortLivedKey, 'secret', { maxAge: 100 });
  
  const immediate = await cacheManager.get(shortLivedKey);
  console.log(`Immediate retrieval: ${immediate === 'secret' ? '✅ Found' : '❌ Missing'}`);

  // Wait for 200ms
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const expired = await cacheManager.get(shortLivedKey);
  console.log(`Expired retrieval: ${expired === null ? '✅ Null (Correct)' : '❌ Found (Incorrect)'}`);

  // Test 3: Memory Overflow (Simple Check)
  console.log('\nTest 3: Memory Overflow Simulation');
  // We won't fill 1000 items here, but let's verify multiple sets work
  await cacheManager.clear();
  for (let i = 0; i < 5; i++) {
    await cacheManager.set(`key_${i}`, i);
  }
  const item3 = await cacheManager.get('key_3');
  console.log(`Item 3 retrieval: ${item3 === 3 ? '✅ Found' : '❌ Missing'}`);

  console.log('\n--- Tests Completed ---');
}

testCache().catch(console.error);
