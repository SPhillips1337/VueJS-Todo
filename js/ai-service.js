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
    const basePrompt = `Task: ${task.title}\nDescription: ${task.description || 'No description provided.'}`;

    if (task.githubUrl && task.githubUrl.trim() !== '') {
      const urlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/;
      if (!urlPattern.test(task.githubUrl.trim())) {
        throw new Error('Invalid GitHub repository URL format. Must be https://github.com/user/repo');
      }
      // Sanitize URL to prevent injection
      const sanitizedUrl = task.githubUrl.trim().replace(/[^\w\s:\/\.-]/g, '');

      let prompt = `You are a senior software architect. Analyze the repository at ${sanitizedUrl}.
Context: ${basePrompt}
Generate 3-5 strategic development tasks focusing on code structure, implementation steps, and testing.
The AI should use the GitHub MCP server ${settings.githubMcpUrl || 'at the configured endpoint'} to deeply analyze the project structure, recent commits, or issues.
Output purely a JSON array of objects with "title" (string), "is_agent_task": true, and "agent_status": "unassigned".`;
      return prompt;
    } else {
      return `You are a productivity assistant.
Context: ${basePrompt}
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

      if (!response.ok) throw new Error('Ollama API error');
      const data = await response.json();
      return this.parseResponse(data.response);
    } catch (e) {
      console.warn('Ollama failed, using mock data', e);
      return this.getMockData(prompt.includes('GitHub'));
    }
  },

  async callCloud(prompt, endpoint, model, apiKey) {
    console.log('Simulating Cloud AI call to:', endpoint, 'using model:', model);
    if (!endpoint) {
      console.warn('No Cloud AI endpoint configured, using mock data.');
      return this.getMockData(prompt.includes('GitHub'));
    }
    // Simulation logic would typically include the apiKey in headers
    await new Promise(r => setTimeout(r, 1000));
    return this.getMockData(prompt.includes('GitHub'));
  },

  parseResponse(text) {
    try {
      const jsonMatch = text.match(/\[.*\]/s);
      return JSON.parse(jsonMatch ? jsonMatch[0] : text);
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
