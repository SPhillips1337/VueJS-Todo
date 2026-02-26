const assert = require('assert');

// Mock fetch to simulate CORS/Network failure
let fetchCount = 0;
global.fetch = async (url, options) => {
    fetchCount++;
    console.log(`Fetch ${fetchCount}: ${url} (Content-Type: ${options.headers['Content-Type']})`);

    // Simulate first call failing with TypeError (CORS/Network)
    if (fetchCount === 1) {
        throw new TypeError('Failed to fetch');
    }

    // Simulate second call (Simple Request workaround) failing
    if (fetchCount === 2) {
        return { ok: false, status: 405 }; // Method Not Allowed or similar
    }

    // Simulate third call (Local Fallback) succeeding
    if (fetchCount === 3 && url.includes('localhost')) {
        return {
            ok: true,
            json: async () => ({ response: JSON.stringify(["goal1"]) })
        };
    }

    return { ok: false };
};

// Mock AIService
const AIService = {
    parseResponse: (text) => JSON.parse(text),
    // ... existing callOllama logic ...
    async callOllama(prompt, endpoint, model) {
        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model || 'llama3',
                prompt: prompt + " Respond ONLY with valid JSON array.",
                stream: false,
                format: 'json'
            })
        };

        try {
            let response = await fetch(endpoint, fetchOptions);

            if (!response.ok) throw new Error('Ollama API error: ' + response.statusText);
            const data = await response.json();
            return this.parseResponse(data.response);
        } catch (e) {
            if (e.name === 'TypeError' || e.message.includes('Failed to fetch')) {
                try {
                    const simpleResponse = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain' },
                        body: fetchOptions.body
                    });
                    if (simpleResponse.ok) {
                        const data = await simpleResponse.json();
                        return this.parseResponse(data.response);
                    }
                } catch (simpleErr) { }

                if (!endpoint.includes('localhost') && !endpoint.includes('127.0.0.1')) {
                    try {
                        const localResponse = await fetch('http://localhost:11434/api/generate', fetchOptions);
                        if (localResponse.ok) {
                            const data = await localResponse.json();
                            return this.parseResponse(data.response);
                        }
                    } catch (localErr) { }
                }

                throw new Error("CORS/Network Failure Instructions...");
            }
            throw e;
        }
    }
};

async function test() {
    console.log("Testing Ollama CORS Workaround & Fallback...");
    try {
        const result = await AIService.callOllama("test", "https://tunnel.example.com", "llama3");
        assert.deepStrictEqual(result, ["goal1"]);
        assert.strictEqual(fetchCount, 3);
        console.log("PASS: Workaround and Fallback logic verified.");
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}

test();
