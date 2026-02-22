document.addEventListener('DOMContentLoaded', function () {
  var todoApp = new Vue({
    el: '#todoApp',
    data: {
      addTodoInput: '',
      lists: [],
      hasError: false,
      selectedTask: null
    },
    computed: {
      filterLists: function () {
        return _.orderBy(this.lists, ['isComplete', 'id'], ['asc', 'desc'])
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
    },
    methods: {
      addTask: function () {
        if (!this.addTodoInput.trim()) {
          this.hasError = true;
          return;
        }

        this.hasError = false;
        const newTodo = {
          id: Date.now(),
          title: this.addTodoInput.trim(),
          description: '',
          isComplete: false,
          subtasks: []
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
      },
      selectTask: function (list) {
        this.selectedTask = list;
      },
      addSubtask: function () {
        if (this.selectedTask) {
          this.selectedTask.subtasks.push({
            id: Date.now(),
            title: '',
            isComplete: false
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
      loadData: function () {
        const data = localStorage.getItem('todo_app_data');
        if (data) {
          try {
            this.lists = JSON.parse(data);
          } catch (e) {
            console.error('Failed to load data', e);
            this.lists = [];
          }
        }
      }
    }
  })
});

