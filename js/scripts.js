document.addEventListener('DOMContentLoaded', function () {
  // Register components and filters
  // Register components and filters
  var draggableComponent = window.vuedraggable || window.VueDraggable || (typeof vuedraggable !== 'undefined' ? vuedraggable : null);

  if (draggableComponent) {
    // If it's the module with .default, use that (some UMD wrappers do this)
    if (draggableComponent.default) draggableComponent = draggableComponent.default;
    Vue.component('draggable', draggableComponent);
    console.log('vuedraggable registered successfully');
  } else {
    console.error('vuedraggable not found. Checked: window.vuedraggable, window.VueDraggable, vuedraggable');
  }
  Vue.filter('truncate', function (text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  });

  Vue.directive('focus', {
    inserted: function (el) {
      el.focus();
    }
  });

  var todoApp = new Vue({
    el: '#todoApp',
    data: {
      addTodoInput: '',
      lists: [],
      hasError: false,
      selectedTask: null, editingId: null,
      aiProvider: 'ollama',
      isGenerating: false,
      showSettings: false, isMaximized: false, showSubtaskModal: false, filterStatus: "all", sortBy: "date", sortOrder: "desc", editingSubtask: null, originalSubtask: null, originalTitle: null,
      aiSettings: {
        ollamaEndpoint: 'http://localhost:11434/api/generate',
        ollamaModel: 'llama3',
        cloudEndpoint: '',
        cloudModel: 'gpt-4o',
        cloudKey: '',
        githubMcpUrl: ''
      }
    },
    computed: {
      filteredLists: function () {
        let result = this.lists.slice();

        // Filter
        if (this.filterStatus !== "all") {
          result = result.filter(item => item.status === this.filterStatus);
        }

        // Sort
        if (this.sortBy === "date") {
          result.sort((a, b) => {
            const dateA = parseInt(a.id.split("-")[0]);
            const dateB = parseInt(b.id.split("-")[0]);
            return this.sortOrder === "asc" ? dateA - dateB : dateB - dateA;
          });
        } else if (this.sortBy === "title") {
          result.sort((a, b) => {
            const titleA = a.title.toLowerCase();
            const titleB = b.title.toLowerCase();
            if (titleA < titleB) return this.sortOrder === "asc" ? -1 : 1;
            if (titleA > titleB) return this.sortOrder === "asc" ? 1 : -1;
            return 0;
          });
        } else if (this.sortBy === "status") {
          result.sort((a, b) => {
            const statusA = a.status.toLowerCase();
            const statusB = b.status.toLowerCase();
            if (statusA < statusB) return this.sortOrder === "asc" ? -1 : 1;
            if (statusA > statusB) return this.sortOrder === "asc" ? 1 : -1;
            return 0;
          });
        }

        return result;
      }
    },
    watch: {
      lists: {
        handler: function (newLists) {
          this.saveData();
        },
        deep: true
      }
    },
    mounted: function () {
      this.loadData();
      this.loadSettings();
    },
    methods: {
      openSettings: function () {
        this.showSettings = true;
      },
      toggleMaximize: function () {
        this.isMaximized = !this.isMaximized;
      },
      openSubtaskModal: function (subtask) {
        this.originalSubtask = subtask;
        this.editingSubtask = Object.assign({}, subtask);
        this.showSubtaskModal = true;
      },
      closeSubtaskModal: function () {
        this.showSubtaskModal = false;
        this.editingSubtask = null;
        this.originalSubtask = null;
      },
      saveSubtask: function () {
        if (this.originalSubtask && this.editingSubtask) {
          Object.assign(this.originalSubtask, this.editingSubtask);
          this.saveData();
        }
        this.closeSubtaskModal();
      },
      closeSettings: function () {
        this.showSettings = false;
        this.loadSettings(); // Revert changes if not saved
      },
      saveSettings: function () {
        localStorage.setItem('todo_ai_settings', JSON.stringify(this.aiSettings));
        this.showSettings = false;
        // Update AIService global settings if needed, though it reads from storage
      },
      loadSettings: function () {
        const settings = localStorage.getItem('todo_ai_settings');
        if (settings) {
          try {
            this.aiSettings = Object.assign({}, this.aiSettings, JSON.parse(settings));
          } catch (e) {
            console.error('Failed to load settings', e);
          }
        }
      },
      addTask: function () {
        if (!this.addTodoInput.trim()) {
          this.hasError = true;
          return;
        }

        this.hasError = false;
        const newTodo = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: this.addTodoInput.trim(),
          description: '',
          isComplete: false,
          subtasks: [],
          githubUrl: '',
          status: 'pending',
          is_agent_task: false,
          target_repo: '',
          agent_status: 'unassigned'
        };

        this.lists.push(newTodo);
        this.addTodoInput = '';
        this.selectTask(newTodo);
      },
      removeTask: function (list) {
        const index = _.findIndex(this.lists, { id: list.id });
        if (index > -1) {
          this.lists.splice(index, 1);
          if (this.selectedTask && this.selectedTask.id === list.id) {
            this.selectedTask = null;
          }
        }
      },
      completeTask: function (e, list) {
        list.isComplete = !list.isComplete;
        if (list.isComplete) {
          list.status = "completed";
        } else {
          list.status = "pending";
        }
      },
      cycleStatus: function (list) {
        if (!list.status || list.status === "pending") {
          list.status = "in-progress";
          list.isComplete = false;
        } else if (list.status === "in-progress") {
          list.status = "completed";
          list.isComplete = true;
        } else {
          list.status = "pending";
          list.isComplete = false;
        }
      },
      startEdit: function (list) {
        this.editingId = list.id;
        this.originalTitle = list.title;
        this.$nextTick(() => {
          const refName = 'editInput-' + list.id;
          const el = this.$refs[refName];
          if (el) {
            if (Array.isArray(el)) {
              el[0].focus();
            } else {
              el.focus();
            }
          }
        });
      },
      stopEdit: function () {
        this.editingId = null;
        this.originalTitle = null;
        this.saveData();
      },
      cancelEdit: function (list) {
        if (this.editingId === list.id && this.originalTitle !== null) {
          list.title = this.originalTitle;
        }
        this.editingId = null;
        this.originalTitle = null;
      },
      selectTask: function (list) {
        this.selectedTask = list;
      },
      addSubtask: function () {
        if (this.selectedTask) {
          this.selectedTask.subtasks.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: '',
            isComplete: false,
            is_agent_task: false,
            target_repo: this.selectedTask.githubUrl || '',
            agent_status: 'unassigned'
          });
        }
      },
      removeSubtask: function (index) {
        if (this.selectedTask) {
          this.selectedTask.subtasks.splice(index, 1);
        }
      },
      saveData: function () {
        localStorage.setItem('todo_app_data', JSON.stringify(this.lists));
      },
      exportData: function () {
        const dataStr = JSON.stringify(this.lists, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "todo-data.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      triggerImport: function () {
        this.$refs.fileInput.click();
      },
      importData: function (event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
              this.lists = data.filter(item => item && typeof item === "object" && typeof item.id !== "undefined" && typeof item.title === "string");
              this.saveData();
              alert("Data imported successfully!");
            } else {
              alert("Invalid file format. Expected a list of tasks.");
            }
          } catch (err) {
            console.error(err);
            alert("Failed to parse file.");
          }
        };
        reader.readAsText(file);
        event.target.value = "";
      },
      loadData: function () {
        const data = localStorage.getItem('todo_app_data');
        if (data) {
          try {
            this.lists = JSON.parse(data);
            // Migration
            this.lists.forEach(list => {
              if (!list.status) {
                list.status = list.isComplete ? "completed" : "pending";
              }
              if (!list.githubUrl) {
                list.githubUrl = "";
              }
              // Subtask migration
              if (list.subtasks) {
                list.subtasks.forEach(sub => {
                  if (sub.is_agent_task === undefined) sub.is_agent_task = false;
                  if (!sub.target_repo) sub.target_repo = list.githubUrl || '';
                  if (!sub.agent_status) sub.agent_status = 'unassigned';
                });
              }
            });
          } catch (e) {
            console.error('Failed to load data', e);
            this.lists = [];
          }
        }
      },
      generateSubtasksForSelected: async function () {
        if (!this.selectedTask) return;

        this.isGenerating = true;
        try {
          const newSubtasks = await AIService.generateSubtasks(this.selectedTask, this.aiProvider);

          if (newSubtasks && Array.isArray(newSubtasks)) {
            newSubtasks.forEach(sub => {
              this.selectedTask.subtasks.push({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: sub.title,
                isComplete: false,
                is_agent_task: sub.is_agent_task ?? false,
                target_repo: this.selectedTask.githubUrl || '',
                agent_status: sub.agent_status || 'unassigned'
              });
            });
          }
        } catch (e) {
          console.error("Failed to generate subtasks", e);
          alert("Failed to generate subtasks. Check console for details.");
        } finally {
          this.isGenerating = false;
        }
      }
    }
  })
});
