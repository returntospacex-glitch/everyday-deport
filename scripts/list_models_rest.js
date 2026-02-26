const key = "AIzaSyAdRQyvQTq7e6CgTqk0aTkq27dCOkPHhD4";

async function listModels() {
    const versions = ["v1", "v1beta"];
    for (const v of versions) {
        console.log(`--- Checking API Version ${v} ---`);
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/${v}/models?key=${key}`);
            const data = await response.json();
            if (data.models) {
                console.log(`✅ SUCCESS (${v}): Found ${data.models.length} models.`);
                data.models.forEach(m => console.log(` - ${m.name}`));
            } else {
                console.log(`❌ FAIL (${v}):`, data.error?.message || "No models list found.");
            }
        } catch (e) {
            console.log(`❌ ERROR (${v}):`, e.message);
        }
    }
}

listModels();
