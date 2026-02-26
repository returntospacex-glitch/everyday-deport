const { GoogleGenerativeAI } = require("@google/generative-ai");

async function check(apiVersion) {
    const key = "AIzaSyAdRQyvQTq7e6CgTqk0aTkq27dCOkPHhD4";
    // Specify API version if the SDK allows it in the constructor or options
    // In newer versions it might be in an options object
    const genAI = new GoogleGenerativeAI(key);

    const variants = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
        "gemini-1.5-pro-latest",
        "gemini-pro"
    ];

    console.log(`--- Testing with API Version Default (usually v1beta) ---`);
    for (const m of variants) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            await model.generateContent("hi");
            console.log(`✅ SUCCESS: ${m}`);
            return true;
        } catch (e) {
            console.log(`❌ FAIL: ${m}: ${e.message}`);
        }
    }
    return false;
}

check();
