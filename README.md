# TaskMaster

A premium, modern, and mobile-responsive Todo application built with VueJS.

![TaskMaster UI](https://via.placeholder.com/800x400?text=TaskMaster+UI+Mockup)

## Features

- **Glassmorphism Design**: A sleek, modern interface with blurred backgrounds and vibrant gradients.
- **Two-Column Layout**: Optimized for desktop with a task list on the left and a detailed view on the right.
- **Mobile Responsive**: Seamlessly collapses into a single column on smaller devices.
- **Deep Nesting**: Support for sub-tasks within each main todo.
- **Architectural Enhancements**: Redesigning the todo data structure to support sub-tasks and detailed notes.
- **AI Service Integration**: Implementation of a flexible AI service layer supporting multiple providers and custom configurations.
- **Feature Development**: Implementation of logic for sub-task management, `localStorage` persistence, and AI-powered automation.
- **Detailed Notes**: Add descriptions and extra information to your tasks.
- **Persistence**: All your data is automatically saved to `localStorage`, so nothing is lost on refresh.
- **Smart Sorting**: Tasks are ordered by completion status and creation time.
- **AI Subtask Generation**: Leverage Local Ollama or Cloud AI to automatically generate actionable subtasks.
- **Customizable AI Settings**: Configure your own endpoints, API keys, and model names for full control over AI behavior.
- **GitHub Integration**: Strategic task generation powered by GitHub repo analysis.

## Getting Started

### Prerequisites

No installation is required. This project runs directly in the browser using CDN links for VueJS and Lodash.

### Running Locally

1. Clone the repository or download the files.
2. Open `index.html` in any modern web browser.

## Technologies Used

- [Vue.js 2](https://vuejs.org/v2/guide/)
- [Lodash](https://lodash.com/)
- [Google Fonts (Inter)](https://fonts.google.com/specimen/Inter)
- Vanilla CSS with Flexbox and Grid

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
