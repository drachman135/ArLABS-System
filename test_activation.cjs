const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dpthhttwmtgtbrsjtfcg.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGhodHR3bXRndGJyc2p0ZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTA0NjUsImV4cCI6MjA5ODA4NjQ2NX0.kUHLK0QIVdCu0jAMq3zp8bxDpvg1g-9Mj5FrGoA1tB4';

const EDGE_FUNC_URL = 'http://127.0.0.1:54321';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanUpLicenseAndDevice(licenseKey, secureDeviceId) {
  try {
    console.log(`Resetting license ${licenseKey} and cleaning up devices...`);
    await supabase.rpc('test_reset_license', { p_key: licenseKey, p_status: 'PENDING' });
    if (secureDeviceId) {
      await supabase.from('devices').delete().eq('secure_device_id', secureDeviceId);
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

async function requestActivation(payload) {
  const response = await fetch(EDGE_FUNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return {
    status: response.status,
    data: await response.json()
  };
}

async function runTests() {
  console.log("=== STARTING LICENSE ACTIVATION REGRESSION TESTS ===");
  
  const testLicenseKey = 'AR-VLEIW-U8UYY-9IHCD';
  const testDeviceA = 'SECURE-DEV-AAAAA';
  const testDeviceB = 'SECURE-DEV-BBBBB';

  // Ensure clean state before starting
  await cleanUpLicenseAndDevice(testLicenseKey, testDeviceA);
  await cleanUpLicenseAndDevice(testLicenseKey, testDeviceB);

  try {
    // Test 1: License Not Found
    console.log("\n[Test 1] Activating non-existent license...");
    const res1 = await requestActivation({ license_key: 'AR-NON-EXISTENT-KEY', secure_device_id: testDeviceA });
    console.log("Status:", res1.status);
    console.log("Response:", res1.data);
    if (res1.status !== 404 || res1.data.code !== 'LICENSE_NOT_FOUND') {
      throw new Error("Test 1 Failed");
    }
    console.log("=> Test 1 Passed: Correctly returned 404 LICENSE_NOT_FOUND");

    // Test 2: Successful First-Time Activation
    console.log("\n[Test 2] Activating pending license on Device A...");
    const res2 = await requestActivation({ license_key: testLicenseKey, secure_device_id: testDeviceA, model: 'Test Model A' });
    console.log("Status:", res2.status);
    console.log("Response:", res2.data);
    if (res2.status !== 200 || !res2.data.success) {
      throw new Error("Test 2 Failed");
    }
    console.log("=> Test 2 Passed: First activation succeeded");

    // Verify DB state
    const { data: licenseDb } = await supabase.from('licenses').select('*').eq('license_key', testLicenseKey).single();
    console.log("DB State of License associated_device:", licenseDb.associated_device);
    console.log("DB State of License status:", licenseDb.status);
    if (licenseDb.status !== 'ACTIVE' || licenseDb.associated_device !== testDeviceA) {
      throw new Error("Database state verification failed after Test 2");
    }

    // Test 3: Idempotent Activation (Same Device)
    console.log("\n[Test 3] Re-activating on same Device A (idempotent)...");
    const res3 = await requestActivation({ license_key: testLicenseKey, secure_device_id: testDeviceA });
    console.log("Status:", res3.status);
    console.log("Response:", res3.data);
    if (res3.status !== 200 || !res3.data.success) {
      throw new Error("Test 3 Failed");
    }
    console.log("=> Test 3 Passed: Idempotent same-device request succeeded");

    // Test 4: Blocked Activation (Different Device)
    console.log("\n[Test 4] Activating bound license on Device B...");
    const res4 = await requestActivation({ license_key: testLicenseKey, secure_device_id: testDeviceB });
    console.log("Status:", res4.status);
    console.log("Response:", res4.data);
    if (res4.status !== 400 || res4.data.code !== 'DEVICE_ALREADY_BOUND') {
      throw new Error("Test 4 Failed");
    }
    console.log("=> Test 4 Passed: Correctly blocked activation on a different device");

    // Test 5: Suspended License
    console.log("\n[Test 5] Activating suspended license...");
    console.log("Setting license status to SUSPENDED via helper RPC...");
    const { error: rpcErr5 } = await supabase.rpc('test_reset_license', { p_key: testLicenseKey, p_status: 'SUSPENDED' });
    if (rpcErr5) console.error("RPC Error Test 5:", rpcErr5);

    // Fetch from database directly to verify
    const { data: check5 } = await supabase.from('licenses').select('status, associated_device').eq('license_key', testLicenseKey).single();
    console.log("Verification - DB Status in Test 5 is:", check5.status, "associated_device:", check5.associated_device);

    const res5 = await requestActivation({ license_key: testLicenseKey, secure_device_id: testDeviceA });
    console.log("Status:", res5.status);
    console.log("Response:", res5.data);
    if (res5.status !== 400 || res5.data.code !== 'LICENSE_SUSPENDED') {
      throw new Error("Test 5 Failed");
    }
    console.log("=> Test 5 Passed: Correctly blocked suspended license");

    // Test 6: Expired License
    console.log("\n[Test 6] Activating expired license...");
    console.log("Setting license status to EXPIRED via helper RPC...");
    await supabase.rpc('test_reset_license', { p_key: testLicenseKey, p_status: 'EXPIRED' });
    
    const { data: check6 } = await supabase.from('licenses').select('status').eq('license_key', testLicenseKey).single();
    console.log("Verification - DB Status in Test 6 is:", check6.status);

    const res6 = await requestActivation({ license_key: testLicenseKey, secure_device_id: testDeviceA });
    console.log("Status:", res6.status);
    console.log("Response:", res6.data);
    if (res6.status !== 400 || res6.data.code !== 'LICENSE_EXPIRED') {
      throw new Error("Test 6 Failed");
    }
    console.log("=> Test 6 Passed: Correctly blocked expired license");

    console.log("\n=== ALL REGRESSION TESTS PASSED SUCCESSFULLY ===");

  } catch (err) {
    console.error("\n!!! REGRESSION TEST FAILED !!!");
    console.error(err.message);
  } finally {
    console.log("\nCleaning up test records...");
    await cleanUpLicenseAndDevice(testLicenseKey, testDeviceA);
    await cleanUpLicenseAndDevice(testLicenseKey, testDeviceB);
    console.log("Cleanup done.");
    process.exit(0);
  }
}

runTests();
