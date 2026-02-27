const { GoogleGenerativeAI } = require("@google/generative-ai");

async function finalVerify() {
    const key = "AIzaSyClWvRdyU1eopx4Ju2SJ4tMNN5kj7B8fBM";
    console.log("Final verification with Key:", key.substring(0, 10) + "...");

    const models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash-001",
        "gemini-flash-latest",
        "gemini-pro-latest"
    ];

    const genAI = new GoogleGenerativeAI(key);

    for (const m of models) {
        process.stdout.write(`Testing ${m}... `);
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("hi");
            console.log("✅ SUCCESS");
        } catch (e) {
            console.log(`❌ FAIL - ${e.message.substring(0, 100)}...`);
        }
    }
}

finalVerify();
