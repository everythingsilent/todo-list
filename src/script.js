const taskInput = document.getElementById('new-task');
const taskList = document.getElementById('task-list');
const taskFilter = document.getElementById('task-filter');
const ganttChartContainer = document.getElementById('gantt-chart-container');
const ganttChartCanvas = document.getElementById('gantt-chart');
let ganttChart = null;
let tasks = []; // 从本地存储加载任务
let currentFilter = 'all'; // 初始化筛选状态

// 注册 Chart.js Annotation 插件
if (Chart.annotation) {
    Chart.register(Chart.annotation);
}

// 注册拖动插件
if (Chart.register) {
    Chart.register({
        id: 'dragdata',
        beforeInit: function(chart) {
            chart.config.options.dragData = chart.config.options.dragData || {};
            chart.config.options.dragData.round = 1;
            chart.config.options.dragData.showTooltip = true;
        }
    });
}

// 拖动分割功能
function initResizer() {
    const resizer = document.getElementById('dragMe');
    const leftSide = resizer.previousElementSibling;
    const rightSide = resizer.nextElementSibling;

    // 设置初始宽度为左七右三
    leftSide.style.flex = '0 0 70%';
    rightSide.style.flex = '0 0 30%';

    // 鼠标按下事件处理
    let x = 0;
    let leftWidth = 0;

    const mouseDownHandler = function(e) {
        x = e.clientX;
        leftWidth = leftSide.getBoundingClientRect().width;

        // 添加事件监听器
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        // 添加样式
        resizer.classList.add('dragging');
    };

    const mouseMoveHandler = function(e) {
        // 计算鼠标移动距离
        const dx = e.clientX - x;
        const containerWidth = resizer.parentNode.getBoundingClientRect().width;
        
        // 计算新的左侧宽度（百分比）
        let newLeftWidth = ((leftWidth + dx) / containerWidth) * 100;
        
        // 限制最小和最大宽度
        newLeftWidth = Math.max(20, Math.min(newLeftWidth, 80));
        
        // 设置新的宽度
        leftSide.style.flex = `0 0 ${newLeftWidth}%`;
        rightSide.style.flex = `0 0 ${100 - newLeftWidth}%`;
    };

    const mouseUpHandler = function() {
        // 移除事件监听器
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        resizer.classList.remove('dragging');
    };

    // 添加鼠标按下事件监听器
    resizer.addEventListener('mousedown', mouseDownHandler);
}

// 页面加载完成后初始化拖动功能
document.addEventListener('DOMContentLoaded', function() {
    initResizer();
});

// 检查必要的DOM元素是否存在
function checkRequiredElements() {
    const elements = {
        taskInput,
        taskList,
        ganttChartContainer,
        ganttChartCanvas
    };

    for (const [name, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`Required element not found: ${name}`);
            return false;
        }
    }
    return true;
}

// 初始化
function init() {
    if (!checkRequiredElements()) {
        console.error('初始化失败：缺少必要的DOM元素');
        return;
    }

    loadTasks();
    setupEventListeners();
    // 初始显示甘特图
    if (tasks.length > 0) {
        ganttChartContainer.style.display = 'block';
        updateGanttChart();
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 添加任务的事件监听
    taskInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter' && this.value.trim() !== '') {
            addTask(this.value.trim());
            this.value = '';
        }
    });
}

// 初始化加载任务
function loadTasks() {
    try {
        const savedTasks = JSON.parse(localStorage.getItem('tasks')) || [];
        tasks = savedTasks.map(task => ({
            ...task,
            startDate: new Date(task.startDate),
            endDate: new Date(task.endDate)
        }));
        renderTasks();
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasks = [];
    }
}

function addTask(text) {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // 设置开始时间为当天 00:00
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999); // 设置结束时间为次日 23:59

    const task = {
        id: Date.now(),
        text: text,
        completed: false,
        startDate: now,
        endDate: tomorrow
    };
    // 将新任务添加到数组开头
    tasks.unshift(task);
    saveTasks();
    renderTasks();
    updateGanttChart();
}

function renderTasks() {
    taskList.innerHTML = '';
    
    // 对任务进行排序：未完成的在前，已完成的在后
    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.completed === b.completed) {
            // 如果完成状态相同，保持原有顺序
            return 0;
        }
        // 未完成的排在前面
        return a.completed ? 1 : -1;
    });
    
    const filteredTasks = filterTasks(sortedTasks);
    
    filteredTasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.dataset.id = task.id;
        li.dataset.index = index;
        li.className = task.completed ? 'completed' : '';
        li.innerHTML = `
            <span class="task-number">${index + 1}</span>
            <input type="checkbox" ${task.completed ? 'checked' : ''}>
            <div class="task-content">
                <span class="task-text" ondblclick="makeEditable(this, ${task.id})">${task.text}</span>
                <div class="date-controls">
                    <div class="date-range">
                        <input type="text" class="daterangepicker-input" data-task-id="${task.id}" 
                               value="${formatDateTimeLocal(task.startDate).replace('T', ' ')} - ${formatDateTimeLocal(task.endDate).replace('T', ' ')}">
                    </div>
                </div>
            </div>
            <button class="delete-btn">删除</button>
        `;
        taskList.appendChild(li);

        // 添加事件监听器
        li.querySelector('input[type="checkbox"]').addEventListener('change', () => toggleComplete(task.id));
        li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));
        
        // 初始化日期范围选择器
        initializeDateRangePicker(task.id);
    });

    if(Sortable && taskList.children.length > 0) {
        new Sortable(taskList, {
            animation: 150,
            onEnd: (evt) => {
                // 获取所有任务的新顺序
                const newOrder = Array.from(taskList.children).map(li => {
                    return tasks.find(t => t.id === parseInt(li.dataset.id));
                });
                
                // 更新任务数组
                tasks = newOrder;
                saveTasks();
                renderTasks(); // 重新渲染以更新序号
                updateGanttChart();
            }
        });
    }

    // 更新甘特图
    updateGanttChart();
}

function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
        updateGanttChart(); // 完成状态改变时更新甘特图
    }
}

function updateDate(id, type, dateString) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newDate = new Date(dateString);
    if (isNaN(newDate.getTime())) {
        alert('无效的日期');
        renderTasks();
        return;
    }

    // 设置时间为当天的开始或结束
    if (type === 'startDate') {
        newDate.setHours(0, 0, 0, 0);
    } else {
        newDate.setHours(23, 59, 59, 999);
    }

    // 验证日期范围
    const otherDate = type === 'startDate' ? task.endDate : task.startDate;
    if ((type === 'startDate' && newDate > task.endDate) ||
        (type === 'endDate' && newDate < task.startDate)) {
        alert('开始日期必须早于结束日期');
        renderTasks();
        return;
    }

    task[type] = newDate;
    saveTasks();
    renderTasks();
    updateGanttChart(); // 日期更新时更新甘特图
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    updateGanttChart(); // 删除任务时更新甘特图
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function updateGanttChart() {
    if (tasks.length === 0) {
        ganttChartContainer.style.display = 'none';
        if (ganttChart) {
            ganttChart.destroy();
            ganttChart = null;
        }
        return;
    }

    ganttChartContainer.style.display = 'block';

    // 使用当前筛选后的已排序任务列表
    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.completed === b.completed) {
            return 0;
        }
        return a.completed ? 1 : -1;
    });
    const filteredTasks = filterTasks(sortedTasks);
    
    // 根据任务数量动态调整容器高度
    const containerHeight = filteredTasks.length > 6 ? '1000px' : '500px';
    ganttChartContainer.style.minHeight = containerHeight;
    
    // 计算合适的图表高度
    const taskCount = filteredTasks.length;
    const heightPerTask = Math.max(50, Math.min(80, Math.floor(parseInt(containerHeight) / taskCount)));
    const calculatedHeight = taskCount * heightPerTask;
    
    // 设置画布高度
    ganttChartCanvas.style.height = `${calculatedHeight}px`;
    
    // 找出最早和最晚的日期
    const minDate = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
    const maxDate = new Date(Math.max(...tasks.map(t => t.endDate.getTime())));

    // 确保时间范围至少包含一天
    if (minDate.getTime() === maxDate.getTime()) {
        maxDate.setDate(maxDate.getDate() + 1);
    }

    const config = {
        type: 'bar',
        data: {
            datasets: [{
                label: '任务时间线',
                data: filteredTasks.map((task, index) => ({
                    x: [task.startDate, task.endDate],
                    y: `${index + 1}. ${task.text}`
                })),
                backgroundColor: filteredTasks.map(task => 
                    task.completed ? 'rgba(76, 175, 80, 0.5)' : 'rgba(33, 150, 243, 0.5)'
                ),
                borderColor: filteredTasks.map(task => 
                    task.completed ? 'rgba(76, 175, 80, 0.8)' : 'rgba(33, 150, 243, 0.8)'
                ),
                borderWidth: 1,
                borderSkipped: false,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            layout: {
                padding: {
                    top: 10,
                    bottom: 10
                }
            },
            scales: {
                x: {
                    position: 'top',
                    type: 'time',
                    min: minDate,
                    max: maxDate,
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'ddd DD' // 添加周几的显示
                        },
                        tooltipFormat: 'YYYY-MM-DD HH:mm'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            },
            plugins: {
                annotation: {
                    annotations: {
                        currentDate: {
                            type: 'line',
                            xMin: new Date(),
                            xMax: new Date(),
                            borderColor: 'red',
                            borderWidth: 2,
                            label: {
                                content: '当前',
                                enabled: true,
                                position: 'top'
                            }
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const task = filteredTasks[context.dataIndex];
                            const startTime = formatDateTimeLocal(task.startDate).replace('T', ' ');
                            const endTime = formatDateTimeLocal(task.endDate).replace('T', ' ');
                            return [
                                `状态: ${task.completed ? '已完成' : '进行中'}`,
                                `开始: ${startTime}`,
                                `结束: ${endTime}`
                            ];
                        }
                    }
                },
                legend: {
                    display: false
                }
            }
        }
    };

    if (ganttChart) {
        ganttChart.destroy();
    }
    ganttChart = new Chart(ganttChartCanvas, config);
}

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateTimeLocal(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
}

function filterTasks(tasks) {
    let filteredTasks = [...tasks];
    switch (currentFilter) {
        case 'active':
            return filteredTasks.filter(task => !task.completed);
        case 'completed':
            return filteredTasks.filter(task => task.completed);
        default:
            return filteredTasks;
    }
}

// 添加双击编辑功能
function makeEditable(element, taskId) {
    const originalText = element.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'edit-task-input';
    
    // 替换原有文本为输入框
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();

    // 处理失去焦点和回车事件
    function handleEdit(e) {
        const newText = input.value.trim();
        if (newText && newText !== originalText) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.text = newText;
                saveTasks();
                renderTasks();
                updateGanttChart();
            }
        } else {
            element.textContent = originalText;
        }
    }

    input.addEventListener('blur', handleEdit);
    input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            handleEdit(e);
        } else if (e.key === 'Escape') {
            element.textContent = originalText;
        }
    });
}

// 初始化日期范围选择器
function initializeDateRangePicker(taskId) {
    const input = document.querySelector(`.daterangepicker-input[data-task-id="${taskId}"]`);
    if (!input) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    $(input).daterangepicker({
        timePicker: true,
        timePicker24Hour: true,
        timePickerIncrement: 30,
        startDate: task.startDate,
        endDate: task.endDate,
        locale: {
            format: 'YYYY-MM-DD HH:mm',
            applyLabel: '确定',
            cancelLabel: '取消',
            fromLabel: '从',
            toLabel: '至',
            customRangeLabel: '自定义',
            daysOfWeek: ['日', '一', '二', '三', '四', '五', '六'],
            monthNames: ['一月', '二月', '三月', '四月', '五月', '六月',
                        '七月', '八月', '九月', '十月', '十一月', '十二月'],
            firstDay: 1
        }
    }, function(start, end) {
        // 更新任务的开始和结束时间
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            // 确保时间设置正确
            const startDate = start.toDate();
            startDate.setHours(0, 0, 0, 0);
            const endDate = end.toDate();
            endDate.setHours(23, 59, 59, 999);
            
            task.startDate = startDate;
            task.endDate = endDate;
            saveTasks();
            updateGanttChart();
        }
    });
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
