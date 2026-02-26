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
      selectedTask: null, editingId: null, goals: [], currentTab: "tasks", editingGoal: null, originalGoal: null,
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
            const idA = String(a.id);
            const idB = String(b.id);
            const dateA = parseInt(idA.split("-")[0]);
            const dateB = parseInt(idB.split("-")[0]);
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
          this.debouncedSaveData();
        },
        deep: true
      }
    },
    created: function () {
      this.debouncedSaveData = _.debounce(this.saveData, 500);
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
          this.debouncedSaveData();
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
          agent_status: 'unassigned',
          goalIds: []
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
        this.debouncedSaveData();
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
            description: '',
            isComplete: false,
            is_agent_task: false,
            target_repo: this.selectedTask.githubUrl || '',
            agent_status: 'unassigned',
          goalIds: []
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
        localStorage.setItem('todo_app_goals', JSON.stringify(this.goals));
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
              this.lists = data.filter(item => item && typeof item === "object" && typeof item.id !== "undefined" && typeof item.title === "string").map(item => {
                item.id = String(item.id);
                return item;
              });
              this.debouncedSaveData();
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
        const goalData = localStorage.getItem('todo_app_goals');

        if (goalData) {
          try {
            this.goals = JSON.parse(goalData);
          } catch (e) {
            console.error('Failed to load goals', e);
            this.goals = [];
          }
        }
        if (data) {
          try {
            this.lists = JSON.parse(data);
            // Migration
            this.lists.forEach(list => {
              if (list.id !== undefined) list.id = String(list.id);
              if (!list.status) {
                list.status = list.isComplete ? "completed" : "pending";
              }
              if (!list.githubUrl) {
                list.githubUrl = "";
              }
              if (!list.goalIds) {
                list.goalIds = [];
              }
              // Subtask migration
              if (list.subtasks) {
                list.subtasks.forEach(sub => {
                  if (sub.id !== undefined) sub.id = String(sub.id);
                  if (sub.is_agent_task === undefined) sub.is_agent_task = false;
                  if (!sub.description) sub.description = '';
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

      addGoal: function (title, label, description) {
        if (!title || !label) {
          alert("Title and Label are required.");
          return;
        }
        this.goals.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: title,
          label: label.substring(0, 5).toUpperCase(),
          description: description || ''
        });
        this.debouncedSaveData();
      },
      removeGoal: function (goalId) {
        if (!confirm("Are you sure you want to delete this goal? It will be removed from all tasks.")) return;

        const index = this.goals.findIndex(g => g.id === goalId);
        if (index > -1) {
          this.goals.splice(index, 1);
          // Remove from tasks
          this.lists.forEach(task => {
            if (task.goalIds) {
              const gIndex = task.goalIds.indexOf(goalId);
              if (gIndex > -1) task.goalIds.splice(gIndex, 1);
            }
          });
          this.debouncedSaveData();
        }
      },
      updateGoal: function (goal) {
        const index = this.goals.findIndex(g => g.id === goal.id);
        if (index > -1) {
          // Update in place
          this.goals.splice(index, 1, goal);
          this.debouncedSaveData();
        }
      },
      toggleGoalForTask: function (task, goalId) {
        if (!task.goalIds) {
          this.$set(task, 'goalIds', []);
        }
        const index = task.goalIds.indexOf(goalId);
        if (index > -1) {
          task.goalIds.splice(index, 1);
        } else {
          task.goalIds.push(goalId);
        }
        this.debouncedSaveData();
      },
      getGoal: function (goalId) {
        return this.goals.find(g => g.id === goalId);
      },
      suggestGoalsForSelected: async function () {
        if (!this.selectedTask) return;
        this.isGenerating = true;
        try {
          const suggestedIds = await AIService.suggestGoals(this.selectedTask, this.goals, this.aiProvider);
          if (suggestedIds && Array.isArray(suggestedIds)) {
            // Apply suggestions
            if (suggestedIds.length === 0) {
              alert("No suitable goals found.");
            } else {
              let addedCount = 0;
              suggestedIds.forEach(sid => {
                // Check if goal exists and not already assigned
                if (this.goals.find(g => g.id === sid) && (!this.selectedTask.goalIds || !this.selectedTask.goalIds.includes(sid))) {
                  if (!this.selectedTask.goalIds) this.$set(this.selectedTask, 'goalIds', []);
                  this.selectedTask.goalIds.push(sid);
                  addedCount++;
                }
              });
              if (addedCount > 0) {
                this.debouncedSaveData();
                alert(`Added ${addedCount} suggested goals.`);
              } else {
                alert("No new goals suggested (all matching goals already assigned).");
              }
            }
          }
        } catch (e) {
          console.error("Failed to suggest goals", e);
          alert("Failed to suggest goals: " + (e.message || "Unknown error"));
        } finally {
          this.isGenerating = false;
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
                description: sub.description || '',
                isComplete: false,
                is_agent_task: sub.is_agent_task ?? false,
                target_repo: this.selectedTask.githubUrl || '',
                agent_status: sub.agent_status || 'unassigned'
              });
            });
          }
        } catch (e) {
          console.error("Failed to generate subtasks", e);
          alert("Failed to generate subtasks: " + (e.message || "Unknown error"));
        } finally {
          this.isGenerating = false;
        }
      }
    }
  })
});
