const AIService = {
  ollamaEndpoint: 'http://localhost:11434/api/generate',

  async generateSubtasks(task, provider = 'ollama') {
    const prompt = this.constructPrompt(task);
    console.log('Generating subtasks with provider:', provider);

    if (provider === 'ollama') {
      return this.callOllama(prompt);
    } else {
      return this.callCloud(prompt);
    }
  },

  constructPrompt(task) {
    const basePrompt = `Task: ${task.title}\nDescription: ${task.description || 'No description provided.'}`;

    if (task.githubUrl && task.githubUrl.trim() !== '') {
      return `You are a senior software architect. Analyze the repository at ${task.githubUrl}.
Context: ${basePrompt}
Generate 3-5 strategic subtasks focusing on code structure, implementation steps, and testing.
Output purely a JSON array of objects with "title" and "is_agent_task": true.`;
    } else {
      return `You are a productivity assistant.
Context: ${basePrompt}
Generate 3-5 actionable subtasks.
Output purely a JSON array of objects with "title".`;
    }
  },

  async callOllama(prompt) {
    try {
      const response = await fetch(this.ollamaEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
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

  async callCloud(prompt) {
    console.log('Simulating Cloud AI call...');
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
