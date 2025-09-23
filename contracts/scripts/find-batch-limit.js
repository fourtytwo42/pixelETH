// Quick script to find current maxBatch limit by testing
console.log(`
🔍 To find your current maxBatch limit, try these test purchases:

Try purchasing these amounts (in order) until one succeeds:
- 100 pixels  ✅ (should work)
- 200 pixels  ✅ (should work) 
- 250 pixels  🤔 (common default limit)
- 300 pixels  🤔 (might work)
- 400 pixels  🤔 (might work)
- 478 pixels  ❌ (your failed amount)

The largest successful amount = your current maxBatch limit

📊 YOUR TRANSACTION ANALYSIS:
- Attempted: 478 pixels
- Total Cost: 0.70773763554 ETH
- Status: ❌ FAILED - BatchTooLarge()

🎯 RECOMMENDED ACTION:
Ask your contract admin to run:
await contract.setMaxBatch(900);

This will allow batches up to 900 pixels based on our gas testing.
`);
