(async () => {
  const DIM = 512;           // embedding dimension
  const KNOWN = 500;         // known users
  const UNKNOWN = 200;       // strangers
  const TOTAL = KNOWN + UNKNOWN;
  const THRESH = 0.46;       // same as your matcher

  // --- helpers ---
  const normalize = (v) => {
    const s = Math.sqrt(v.reduce((a,b)=>a+b*b,0)) || 1e-9;
    return v.map(x => x/s);
  };
  const cosine = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);

  // --- generate registered embeddings (200 known users) ---
  const registered = Array.from({ length: KNOWN }, () =>
    normalize(Array.from({ length: DIM }, () => Math.random() * 2 - 1))
  );

  // --- create test set: 200 known + 100 unknown ---
  const testSet = [
    // known faces (should match themselves)
    ...registered.map((emb, i) => ({ emb, label: "Known" })),
    // random strangers (should be rejected)
    ...Array.from({ length: UNKNOWN }, () => ({
      emb: normalize(Array.from({ length: DIM }, () => Math.random() * 2 - 1)),
      label: "Unknown",
    })),
  ];

  let truePos = 0, falseNeg = 0, falsePos = 0, trueNeg = 0;

  // --- test recognition ---
  for (const test of testSet) {
    const sims = registered.map(r => cosine(test.emb, r));
    const best = Math.max(...sims);
    const matched = best >= THRESH;

    if (test.label === "Known" && matched) truePos++;
    else if (test.label === "Known" && !matched) falseNeg++;
    else if (test.label === "Unknown" && matched) falsePos++;
    else trueNeg++;
  }

  // --- metrics ---
  const precision = truePos / (truePos + falsePos || 1);
  const recall = truePos / (truePos + falseNeg || 1);
  const accuracy = (truePos + trueNeg) / TOTAL;

  console.log(`✅ Simulated: ${KNOWN} known + ${UNKNOWN} unknown = ${TOTAL} total`);
  console.log(`🎯 True Positives (correctly matched): ${truePos}`);
  console.log(`⚠️ False Negatives (missed knowns): ${falseNeg}`);
  console.log(`🚫 False Positives (wrongly matched unknowns): ${falsePos}`);
  console.log(`✅ True Negatives (correctly unknown): ${trueNeg}`);
  console.log(`📈 Precision: ${(precision*100).toFixed(2)}%`);
  console.log(`📊 Recall: ${(recall*100).toFixed(2)}%`);
  console.log(`💯 Accuracy: ${(accuracy*100).toFixed(2)}%`);
})();