/**
 * AI Service for Todo App
 */
const AIService = {
  // ... existing methods ...

  async suggestGoals(task, currentGoals, provider) {
    console.log("Suggesting goals with provider:", provider);
    const settings = this.getSettings();
    const prompt = this.constructGoalPrompt(task, currentGoals);

    if (provider === 'ollama') {
      return this.callOllama(prompt, settings.ollamaEndpoint, settings.ollamaModel);
    } else {
      return this.callCloud(prompt, settings.cloudEndpoint, settings.cloudModel, settings.cloudApiKey);
    }
  },

  async generateSubtasks(task, provider) {
    console.log("Generating subtasks with provider:", provider);
    const settings = this.getSettings();
    const prompt = this.constructPrompt(task);

    if (provider === 'ollama') {
      return this.callOllama(prompt, settings.ollamaEndpoint, settings.ollamaModel);
    } else {
      return this.callCloud(prompt, settings.cloudEndpoint, settings.cloudModel, settings.cloudApiKey);
    }
  },

  getSettings() {
    const saved = localStorage.getItem('aiSettings');
    const defaultSettings = {
      ollamaEndpoint: '/api/generate',
      ollamaModel: 'llama3',
      cloudEndpoint: 'https://api.openai.com/v1/chat/completions',
      cloudModel: 'gpt-4o',
      cloudApiKey: '',
      githubMcpUrl: 'http://localhost:3000/github'
    };
    return saved ? JSON.parse(saved) : defaultSettings;
  },

  constructGoalPrompt(task, currentGoals) {
    const goalList = currentGoals.map(g => g.title).join(', ');
    return `Suggest 3 high-level categories for this task: "${task.title}".
    Current categories are: ${goalList}.
    Respond ONLY with a JSON array of strings. 
    Example: ["Category 1", "Category 2", "Category 3"]`;
  },

  constructPrompt(task) {
    return `Break down the task "${task.title}" into actionable subtasks. 
    Task description: ${task.description || 'none'}.
    Respond ONLY with a JSON array of objects with keys: "title", "description", "is_agent_task".
    Example: [{"title": "Step 1", "description": "Do X", "is_agent_task": false}]`;
  },

  parseResponse(text) {
    if (typeof text !== 'string') return text;

    try {
      // 1. Precise JSON array match
      const arrayMatch = text.match(/\[\s*[\s\S]*?\s*\]/);
      if (arrayMatch) {
        try { return JSON.parse(arrayMatch[0]); } catch (e) { }
      }

      // 2. Look for nested goals if model returned an object with a stringified key
      // This handles the specific failure seen in the logs
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const obj = JSON.parse(jsonMatch[0]);
        // If it's a single key that looks like a stringified object/array, try to parse it
        for (let key in obj) {
          if (key.includes('"goals"') || key.includes('[')) {
            try {
              const inner = JSON.parse(key);
              if (inner.goals) return inner.goals;
              if (Array.isArray(inner)) return inner;
            } catch (e) { }
          }
          // Also check if values are the arrays
          if (Array.isArray(obj[key])) return obj[key];
          if (key === 'goals' && Array.isArray(obj.goals)) return obj.goals;
        }
        return obj;
      }

      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse AI response", text, e);
      throw new Error("Invalid AI response format: " + e.message);
    }
  },

  async callOllama(prompt, endpoint, model) {
    const payload = {
      model: model || 'llama3',
      prompt: prompt + " Respond ONLY with valid JSON array.",
      stream: false,
      format: 'json'
    };

    const attemptDirect = async () => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Ollama API error: ' + response.statusText);
      return response.json();
    };

    const attemptProxy = async () => {
      console.log('Attempting proxy via ai-proxy.php...');
      const response = await fetch('ai-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, payload })
      });
      if (!response.ok) {
        // Try to get error text if not JSON
        const text = await response.text();
        throw new Error(`Proxy error (${response.status}): ${text || response.statusText}`);
      }
      return response.json();
    };

    try {
      // Try direct first (low latency)
      const data = await attemptDirect();
      // If network succeeds, any parse error should be thrown normally without proxy retry
      try {
        return this.parseResponse(data.response);
      } catch (parseErr) {
        throw new Error("AI returned data but format was invalid: " + parseErr.message);
      }
    } catch (e) {
      // ONLY retry proxy if it was a network failure (fetch failed or CORS)
      if (e.message.includes('fetch') || e.message.includes('Network') || e.message.includes('CORS') || e.message.includes('Mixed Content')) {
        console.warn('Direct Ollama call failed (Network/CORS), trying proxy...', e);
        try {
          const data = await attemptProxy();
          return this.parseResponse(data.response);
        } catch (proxyErr) {
          console.error('All connection attempts failed', proxyErr);

          let instructions = "Connection to Ollama failed. This is likely a CORS or Network issue.\n\n";

          if (proxyErr.message.includes('405') || proxyErr.message.includes('Not Allowed')) {
            instructions += "❌ PROXY ERROR: Your Nginx server rejected the PHP proxy (405 Not Allowed).\n" +
              "Since you chose Option C (Nginx Proxy), ensure your app settings use '/api/generate' exactly.\n\n";
          }

          instructions += "FIX (Option C - Nginx): Ensure app endpoint is '/api/generate' and Nginx is reloaded.\n" +
            "FIX (Option B - Ollama): Set OLLAMA_ORIGINS on the remote machine (192.168.5.157).";

          throw new Error(instructions);
        }
      } else {
        // It was a parse error or API error (404/500/etc) - do not retry via proxy
        throw e;
      }
    }
  },

  async callCloud(prompt, endpoint, model, apiKey) {
    if (!apiKey) {
      throw new Error("Cloud AI API Key is missing. Please set it in Settings.");
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error('Cloud AI API error: ' + response.statusText);
      const data = await response.json();
      return this.parseResponse(data.choices[0].message.content);
    } catch (e) {
      console.error('Cloud AI failed', e);
      throw e;
    }
  }
};