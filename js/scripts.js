document.addEventListener('DOMContentLoaded', function () {
  var todoApp = new Vue({
    el: '#todoApp',
    data: {
      addTodoInput: '',
      lists: [],
      hasError: false,
      selectedTask: null,
      aiProvider: 'ollama',
      isGenerating: false
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
    },
    methods: {
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
      generateSubtasksForSelected: async function() {
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
