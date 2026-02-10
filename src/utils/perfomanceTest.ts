import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

interface TestResult {
  endpoint: string;
  firstCallTime: number;
  secondCallTime: number;
  speedup: number;
  cached: boolean;
}

async function testPerformance() {
  console.log('🧪 Starting Performance Tests...\n');
  
  const results: TestResult[] = [];

  // Test 1: Stats endpoint
  console.log('📊 Testing /stats endpoint...');
  const statsTest = await testEndpoint(`${API_URL}/passwords/stats`);
  results.push({ endpoint: '/stats', ...statsTest });

  // Test 2: History endpoint
  console.log('📜 Testing /history endpoint...');
  const historyTest = await testEndpoint(`${API_URL}/passwords/history`);
  results.push({ endpoint: '/history', ...historyTest });

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('📈 PERFORMANCE TEST RESULTS');
  console.log('='.repeat(80));
  
  results.forEach(result => {
    console.log(`\n🔍 Endpoint: ${result.endpoint}`);
    console.log(`   First call (uncached):  ${result.firstCallTime.toFixed(2)}ms`);
    console.log(`   Second call (cached):   ${result.secondCallTime.toFixed(2)}ms`);
    console.log(`   ⚡ Speedup: ${result.speedup.toFixed(2)}x faster`);
    console.log(`   💾 Cache status: ${result.cached ? '✅ Working' : '❌ Not working'}`);
  });

  // Get overall performance metrics
  console.log('\n' + '='.repeat(80));
  console.log('📊 OVERALL METRICS');
  console.log('='.repeat(80));
  
  const metrics = await axios.get(`${API_URL}/passwords/performance`);
  console.log('\n', JSON.stringify(metrics.data.data, null, 2));
}

async function testEndpoint(url: string): Promise<Omit<TestResult, 'endpoint'>> {
  // First call (should be uncached)
  const start1 = Date.now();
  await axios.get(url);
  const firstCallTime = Date.now() - start1;

  // Small delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Second call (should be cached)
  const start2 = Date.now();
  const response2 = await axios.get(url);
  const secondCallTime = Date.now() - start2;

  const speedup = firstCallTime / secondCallTime;
  const cached = response2.data.cached === true;

  return { firstCallTime, secondCallTime, speedup, cached };
}

// Run the test
testPerformance().catch(console.error);