(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js
    module.exports = factory();
  } else {
    // Browser
    root.AIService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

const AIService = {
  getSettings() {
    const settings = localStorage.getItem('todo_ai_settings');
    const defaultSettings = {
      ollamaEndpoint: 'http://localhost:11434/api/generate',
      ollamaModel: 'llama3',
      cloudEndpoint: '',
      cloudModel: 'gpt-4o',
      cloudKey: '',
      githubMcpUrl: ''
    };
    if (settings) {
      try {
        return Object.assign({}, defaultSettings, JSON.parse(settings));
      } catch (e) {
        console.error('Failed to parse settings from localStorage', e);
      }
    }
    return defaultSettings;
  },

  async generateSubtasks(task, provider = 'ollama') {
    const settings = this.getSettings();
    const prompt = this.constructPrompt(task, settings);
    console.log('Generating subtasks with provider:', provider);

    if (provider === 'ollama') {
      return this.callOllama(prompt, settings.ollamaEndpoint, settings.ollamaModel);
    } else {
      return this.callCloud(prompt, settings.cloudEndpoint, settings.cloudModel, settings.cloudKey);
    }
  },

  constructPrompt(task, settings) {
    const sanitize = (str) => {
        if (!str) return '';
        // Remove HTML/XML tags
        return str.replace(/<[^>]*>/g, '').trim();
    };

    const safeTitle = sanitize(task.title);
    const safeDesc = sanitize(task.description || 'No description provided.');

    const basePrompt = `Task: ${safeTitle}\nDescription: ${safeDesc}`;

    if (task.githubUrl && task.githubUrl.trim() !== '') {
      let sanitizedUrl = task.githubUrl.trim();
      try {
        const url = new URL(sanitizedUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
             throw new Error('Only HTTP/HTTPS URLs are allowed.');
        }
        if (url.hostname !== 'github.com') {
             throw new Error('Only github.com URLs are allowed.');
        }
        // Basic path check: user/repo
        if (url.pathname.split('/').filter(p => p).length < 2) {
             throw new Error('Invalid GitHub repository format.');
        }
        sanitizedUrl = url.href;
      } catch (e) {
        throw new Error('Invalid GitHub repository URL: ' + e.message);
      }

      let prompt = `You are a senior software architect. Analyze the repository at ${sanitizedUrl}.
Context:
<user_task>
${basePrompt}
</user_task>

Generate 3-5 strategic development tasks focusing on code structure, implementation steps, and testing.
The AI should use the GitHub MCP server ${settings.githubMcpUrl || 'at the configured endpoint'} to deeply analyze the project structure, recent commits, or issues.
Output purely a JSON array of objects with "title" (string), "is_agent_task": true, and "agent_status": "unassigned".`;
      return prompt;
    } else {
      return `You are a productivity assistant.
Context:
<user_task>
${basePrompt}
</user_task>

Generate 3-5 actionable subtasks.
Output purely a JSON array of objects with "title" (string).`;
    }
  },

  async callOllama(prompt, endpoint, model) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'llama3',
          prompt: prompt + " Respond ONLY with valid JSON array.",
          stream: false,
          format: 'json'
        })
      });

      if (!response.ok) throw new Error('Ollama API error: ' + response.statusText);
      const data = await response.json();
      return this.parseResponse(data.response);
    } catch (e) {
      console.error('Ollama failed', e);
      throw e; // Propagate error
    }
  },

  async callCloud(prompt, endpoint, model, apiKey) {
    if (!apiKey) {
        throw new Error('API Key is required for Cloud AI.');
    }
    if (!endpoint) {
        throw new Error('Cloud Endpoint is required.');
    }

    console.log('Calling Cloud AI:', endpoint, 'using model:', model);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'gpt-4o',
                messages: [
                    { role: "system", content: "You are a helpful assistant. Output JSON only." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`Cloud API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
        return this.parseResponse(content);

    } catch (e) {
        console.error('Cloud AI call failed', e);
        throw e;
    }
  },

  mockCallCloud(prompt, endpoint, model, apiKey) {
    console.log('Simulating Cloud AI call to:', endpoint, 'using model:', model);
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(this.getMockData(prompt.includes('GitHub')));
        }, 1000);
    });
  },

  parseResponse(text) {
    try {
      // Robust JSON extraction: look for [ ... ]
      const start = text.indexOf('[');
      const end = text.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
         const jsonStr = text.substring(start, end + 1);
         return JSON.parse(jsonStr);
      }
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse JSON', e);
      return [];
    }
  },

  getMockData(isGithub) {
    if (isGithub) {
      return [
        { title: "Analyze repo structure", is_agent_task: true, agent_status: "unassigned" },
        { title: "Identify integration points", is_agent_task: true, agent_status: "unassigned" },
        { title: "Draft implementation plan", is_agent_task: true, agent_status: "unassigned" }
      ];
    } else {
      return [
        { title: "Research requirements" },
        { title: "Draft outline" },
        { title: "Implement core logic" }
      ];
    }
  }
};

return AIService;
}));
