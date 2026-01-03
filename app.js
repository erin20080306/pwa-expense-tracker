// Main App Controller
class ExpenseTracker {
    constructor() {
        this.currentScreen = 'welcome';
        this.currentMonth = new Date();
        this.selectedDate = new Date();
        this.transactionType = 'expense';
        this.supabase = null;
        this.chartInstance = null;
        this.init();
    }

    async init() {
        try {
            // Initialize database
            await db.init();
            await initializeDefaultCategories();
            // 不再自動添加範例資料，讓用戶自己添加交易
            // await initializeSampleData();
            
            // Initialize app
            this.setupEventListeners();
            this.loadSettings();
            this.checkPinLock();
            this.setupNotifications();
            
            console.log('Expense Tracker initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }

    setupEventListeners() {
        // Bottom navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const screen = e.currentTarget.dataset.screen;
                this.switchScreen(screen);
            });
        });

        // Transaction type toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                if (type) {
                    this.setTransactionType(type);
                }
            });
        });

        // Period selector
        const periodSelect = document.getElementById('periodSelect');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                this.updateOverviewChart(e.target.value);
            });
        }

        // Settings toggles
        this.setupSettingsListeners();

        // File input for receipt scanning
        const fileInput = document.getElementById('receiptFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleReceiptFile(e.target.files[0]);
            });
        }

        // PIN input
        const pinInput = document.getElementById('pinInput');
        if (pinInput) {
            pinInput.addEventListener('input', (e) => {
                if (e.target.value.length === 6) {
                    this.verifyPin(e.target.value);
                }
            });
        }
    }

    setupSettingsListeners() {
        // PIN Lock toggle
        const pinLockToggle = document.getElementById('pinLockToggle');
        if (pinLockToggle) {
            pinLockToggle.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    this.showPinSetupDialog();
                } else {
                    await this.disablePinLock();
                }
            });
        }

        // Daily reminder toggle
        const dailyReminderToggle = document.getElementById('dailyReminderToggle');
        if (dailyReminderToggle) {
            dailyReminderToggle.addEventListener('change', async (e) => {
                await db.setSetting('dailyReminder', e.target.checked);
                if (e.target.checked) {
                    this.setupDailyReminder();
                }
            });
        }

        // Cloud sync toggle
        const cloudSyncToggle = document.getElementById('cloudSyncToggle');
        if (cloudSyncToggle) {
            cloudSyncToggle.addEventListener('change', async (e) => {
                await db.setSetting('cloudSync', e.target.checked);
                if (e.target.checked) {
                    this.enableCloudSync();
                } else {
                    this.disableCloudSync();
                }
            });
        }

        // Budget inputs
        const monthlyBudgetInput = document.getElementById('monthlyBudgetInput');
        if (monthlyBudgetInput) {
            monthlyBudgetInput.addEventListener('change', async (e) => {
                const amount = parseFloat(e.target.value) || 0;
                const currentMonth = new Date().toISOString().slice(0, 7);
                await db.setBudget(currentMonth, amount);
                this.updateBudgetProgress();
            });
        }

        const savingsGoalInput = document.getElementById('savingsGoalInput');
        if (savingsGoalInput) {
            savingsGoalInput.addEventListener('change', async (e) => {
                const goal = parseFloat(e.target.value) || 0;
                const currentMonth = new Date().toISOString().slice(0, 7);
                const budget = await db.getBudget(currentMonth);
                await db.setBudget(currentMonth, budget.amount, goal);
            });
        }
    }

    async loadSettings() {
        try {
            // Load PIN lock setting
            const pinLockEnabled = await db.getSetting('pinLock');
            const pinLockToggle = document.getElementById('pinLockToggle');
            if (pinLockToggle) {
                pinLockToggle.checked = pinLockEnabled || false;
            }

            // Load daily reminder setting
            const dailyReminder = await db.getSetting('dailyReminder');
            const dailyReminderToggle = document.getElementById('dailyReminderToggle');
            if (dailyReminderToggle) {
                dailyReminderToggle.checked = dailyReminder || false;
            }

            // Load cloud sync setting
            const cloudSync = await db.getSetting('cloudSync');
            const cloudSyncToggle = document.getElementById('cloudSyncToggle');
            if (cloudSyncToggle) {
                cloudSyncToggle.checked = cloudSync || false;
            }

            // Load Supabase settings
            const supabaseUrl = await db.getSetting('supabaseUrl');
            const supabaseKey = await db.getSetting('supabaseKey');
            const supabaseUrlInput = document.getElementById('supabaseUrlInput');
            const supabaseKeyInput = document.getElementById('supabaseKeyInput');
            
            if (supabaseUrlInput) supabaseUrlInput.value = supabaseUrl || '';
            if (supabaseKeyInput) supabaseKeyInput.value = supabaseKey || '';

            // Load budget settings
            const currentMonth = new Date().toISOString().slice(0, 7);
            const budget = await db.getBudget(currentMonth);
            const monthlyBudgetInput = document.getElementById('monthlyBudgetInput');
            const savingsGoalInput = document.getElementById('savingsGoalInput');
            
            if (monthlyBudgetInput) monthlyBudgetInput.value = budget.amount || '';
            if (savingsGoalInput) savingsGoalInput.value = budget.savingsGoal || '';

        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async checkPinLock() {
        try {
            const pinLockEnabled = await db.getSetting('pinLock');
            if (pinLockEnabled) {
                const pin = await db.getPin();
                if (pin) {
                    this.showPinScreen();
                    return;
                }
            }
            this.showMainApp();
        } catch (error) {
            console.error('Error checking PIN lock:', error);
            this.showMainApp();
        }
    }

    showPinScreen() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('pinScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }

    showMainApp() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('pinScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        this.switchScreen('home');
        this.updateAllData();
    }

    async verifyPin(pin) {
        try {
            const storedPin = await db.getPin();
            if (storedPin) {
                const isValid = await this.verifyPinHash(pin, storedPin.hash);
                if (isValid) {
                    this.showMainApp();
                } else {
                    alert('密碼錯誤，請重新輸入。');
                    document.getElementById('pinInput').value = '';
                }
            }
        } catch (error) {
            console.error('Error verifying PIN:', error);
        }
    }

    async verifyPinHash(pin, hash) {
        // Simple hash verification (in production, use proper crypto)
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex === hash;
    }

    switchScreen(screenName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-screen="${screenName}"]`).classList.add('active');

        // Update screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        switch(screenName) {
            case 'home':
                document.getElementById('homeScreen').classList.add('active');
                this.updateHomeScreen();
                break;
            case 'overview':
                document.getElementById('overviewScreen').classList.add('active');
                this.updateOverviewScreen();
                break;
            case 'calendar':
                document.getElementById('calendarScreen').classList.add('active');
                this.updateCalendarScreen();
                break;
            case 'settings':
                document.getElementById('settingsScreen').classList.add('active');
                break;
        }

        this.currentScreen = screenName;
    }

    setTransactionType(type) {
        this.transactionType = type;
        
        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.toggle-btn[data-type="${type}"]`).classList.add('active');

        // Update category options
        this.updateCategoryOptions();
    }

    async updateCategoryOptions() {
        const categorySelect = document.getElementById('transactionCategory');
        if (!categorySelect) return;

        const categories = await db.getCategories(this.transactionType);
        categorySelect.innerHTML = '';

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = `${category.icon} ${category.name}`;
            categorySelect.appendChild(option);
        });
    }

    async updateAllData() {
        await this.updateHomeScreen();
        await this.updateOverviewScreen();
        await this.updateCalendarScreen();
        await this.updateBudgetProgress();
    }

    async updateHomeScreen() {
        try {
            // Get current month data
            const currentMonth = new Date().toISOString().slice(0, 7);
            const startDate = currentMonth + '-01';
            const endDate = currentMonth + '-31';
            
            const stats = await db.getStatistics(startDate, endDate);
            
            // Update balance
            const totalBalance = stats.totalIncome - stats.totalExpenses;
            document.getElementById('totalBalance').textContent = this.formatCurrency(totalBalance);
            document.getElementById('totalIncome').textContent = this.formatCurrency(stats.totalIncome);
            document.getElementById('totalExpenses').textContent = this.formatCurrency(stats.totalExpenses);

            // Update transactions list
            const transactions = await db.getTransactions(10);
            this.updateTransactionsList(transactions);

        } catch (error) {
            console.error('Error updating home screen:', error);
        }
    }

    updateTransactionsList(transactions) {
        const container = document.getElementById('transactionsList');
        if (!container) return;

        container.innerHTML = '';

        if (transactions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">還沒有交易紀錄</p>';
            return;
        }

        transactions.forEach(transaction => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            
            const categoryIcon = this.getCategoryIcon(transaction.category, transaction.type);
            const amountClass = transaction.type === 'income' ? 'income' : 'expense';
            const amountPrefix = transaction.type === 'income' ? '+' : '-';
            
            item.innerHTML = `
                <div class="transaction-icon" style="background: ${this.getCategoryColor(transaction.category)}">
                    ${categoryIcon}
                </div>
                <div class="transaction-details">
                    <div class="transaction-name">${transaction.category}</div>
                    <div class="transaction-time">${this.formatTime(transaction.date)}</div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${amountPrefix}${this.formatCurrency(transaction.amount)}
                </div>
            `;

            item.addEventListener('click', () => {
                editTransaction(transaction);
            });

            container.appendChild(item);
        });
    }

    async updateOverviewScreen() {
        try {
            // Get current month data
            const currentMonth = new Date().toISOString().slice(0, 7);
            const startDate = currentMonth + '-01';
            const endDate = currentMonth + '-31';
            
            const stats = await db.getStatistics(startDate, endDate);
            
            // Update overview cards
            document.getElementById('overviewIncome').textContent = this.formatCurrency(stats.totalIncome);
            document.getElementById('overviewExpenses').textContent = this.formatCurrency(stats.totalExpenses);

            // Update chart
            this.updateOverviewChart('monthly');

            // Update categories list
            this.updateCategoriesList(stats);

        } catch (error) {
            console.error('Error updating overview screen:', error);
        }
    }

    updateOverviewChart(period) {
        // This would be implemented with Chart.js
        // For now, we'll create a placeholder
        const canvas = document.getElementById('statisticsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // Create new chart
        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['第1週', '第2週', '第3週', '第4週'],
                datasets: [{
                    label: '收入',
                    data: [2000, 1500, 2500, 1800],
                    backgroundColor: '#8B5CF6',
                    borderRadius: 8
                }, {
                    label: '支出',
                    data: [1200, 1800, 1500, 2200],
                    backgroundColor: '#F97316',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    updateCategoriesList(stats) {
        const container = document.getElementById('categoriesList');
        if (!container) return;

        container.innerHTML = '';

        const activeType = document.querySelector('.toggle-btn.active').dataset.type;
        const categories = activeType === 'income' ? stats.incomeByCategory : stats.expensesByCategory;

        Object.entries(categories).forEach(([category, amount]) => {
            const item = document.createElement('div');
            item.className = 'category-item';
            
            item.innerHTML = `
                <span class="category-name">${this.getCategoryIcon(category, activeType)} ${category}</span>
                <span class="category-amount">${this.formatCurrency(amount)}</span>
            `;

            container.appendChild(item);
        });

        if (Object.keys(categories).length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No categories yet</p>';
        }
    }

    async updateCalendarScreen() {
        try {
            await this.updateCalendarGrid();
        } catch (error) {
            console.error('Error updating calendar screen:', error);
        }
    }

    updateCalendarGrid() {
        const container = document.getElementById('calendarDays');
        if (!container) {
            console.error('Calendar container not found');
            return;
        }

        // 完全清空
        container.innerHTML = '';

        // 複製日期避免修改原始物件
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth(); // 0-11

        // 更新標題
        const titleEl = document.getElementById('currentMonth');
        if (titleEl) {
            titleEl.textContent = year + '年' + (month + 1) + '月';
        }

        // 計算該月第一天是星期幾 (0=週日, 1=週一, ..., 6=週六)
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        
        // 計算該月總天數
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // 計算上個月的天數
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // 今天的日期
        const today = new Date();

        // 月份名稱
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

        // 建立日曆格子
        let currentDay = 1;
        let nextMonthDay = 1;

        // 總共6行 x 7列 = 42格
        for (let i = 0; i < 42; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';

            if (i < firstDayOfMonth) {
                // 上個月的日期
                const prevDay = daysInPrevMonth - firstDayOfMonth + i + 1;
                cell.innerHTML = '<span class="day-number">' + prevDay + '</span>';
                cell.classList.add('other-month');
                
                // 如果是上個月的1號，加上月份標註
                if (prevDay === 1) {
                    const prevMonth = month === 0 ? 11 : month - 1;
                    cell.innerHTML = '<span class="month-label">' + monthNames[prevMonth] + '</span><span class="day-number">1</span>';
                }
            } else if (currentDay <= daysInMonth) {
                // 當月的日期
                
                // 如果是1號，加上大字月份標註
                if (currentDay === 1) {
                    cell.innerHTML = '<span class="month-label">' + monthNames[month] + '</span><span class="day-number">1</span>';
                } else {
                    cell.innerHTML = '<span class="day-number">' + currentDay + '</span>';
                }
                
                // 標記今天
                if (year === today.getFullYear() && month === today.getMonth() && currentDay === today.getDate()) {
                    cell.classList.add('today');
                }
                
                // 點擊事件
                const clickYear = year;
                const clickMonth = month;
                const clickDay = currentDay;
                cell.onclick = function() {
                    const mm = String(clickMonth + 1).padStart(2, '0');
                    const dd = String(clickDay).padStart(2, '0');
                    document.getElementById('transactionDate').value = clickYear + '-' + mm + '-' + dd;
                    openAddTransaction();
                };
                
                currentDay++;
            } else {
                // 下個月的日期
                // 如果是下個月的1號，加上月份標註
                if (nextMonthDay === 1) {
                    const nextMonth = month === 11 ? 0 : month + 1;
                    cell.innerHTML = '<span class="month-label">' + monthNames[nextMonth] + '</span><span class="day-number">1</span>';
                } else {
                    cell.innerHTML = '<span class="day-number">' + nextMonthDay + '</span>';
                }
                cell.classList.add('other-month');
                nextMonthDay++;
            }

            container.appendChild(cell);
        }
        
        console.log('Calendar rendered for ' + year + '/' + (month + 1) + ', firstDayOfMonth=' + firstDayOfMonth + ', daysInMonth=' + daysInMonth);
    }

    async updateBudgetProgress() {
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const budget = await db.getBudget(currentMonth);
            
            if (budget.amount > 0) {
                const startDate = currentMonth + '-01';
                const endDate = currentMonth + '-31';
                const stats = await db.getStatistics(startDate, endDate);
                
                const spent = stats.totalExpenses;
                const remaining = budget.amount - spent;
                const percentage = (spent / budget.amount) * 100;

                const progressCard = document.getElementById('budgetProgressCard');
                progressCard.style.display = 'block';

                document.getElementById('budgetRemaining').textContent = this.formatCurrency(remaining) + ' remaining';
                document.getElementById('budgetSpent').textContent = this.formatCurrency(spent) + ' spent';
                document.getElementById('budgetTotal').textContent = 'of ' + this.formatCurrency(budget.amount);

                const progressFill = document.getElementById('budgetProgressFill');
                progressFill.style.width = Math.min(percentage, 100) + '%';

                if (percentage > 100) {
                    progressFill.classList.add('over-budget');
                    document.getElementById('budgetRemaining').textContent = 'Over budget by ' + this.formatCurrency(Math.abs(remaining));
                    document.getElementById('budgetRemaining').style.color = '#EF4444';
                } else {
                    progressFill.classList.remove('over-budget');
                    document.getElementById('budgetRemaining').style.color = '#10B981';
                }
            } else {
                document.getElementById('budgetProgressCard').style.display = 'none';
            }
        } catch (error) {
            console.error('Error updating budget progress:', error);
        }
    }

    // Utility functions
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    formatTime(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    getCategoryIcon(categoryName, type) {
        const defaultIcons = {
            income: '💰',
            expense: '💸'
        };
        return defaultIcons[type] || '📝';
    }

    getCategoryColor(categoryName) {
        const colors = [
            '#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B',
            '#EF4444', '#6366F1', '#14B8A6', '#F97316', '#06B6D4'
        ];
        let hash = 0;
        for (let i = 0; i < categoryName.length; i++) {
            hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    // Notification setup
    async setupNotifications() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Notification permission granted');
            }
        }
    }

    setupDailyReminder() {
        // This would set up daily reminders
        // For now, we'll just log it
        console.log('Daily reminder setup');
    }

    // Cloud sync functions
    async enableCloudSync() {
        const supabaseUrl = await db.getSetting('supabaseUrl');
        const supabaseKey = await db.getSetting('supabaseKey');
        
        if (supabaseUrl && supabaseKey) {
            try {
                this.supabase = createClient(supabaseUrl, supabaseKey);
                console.log('Cloud sync enabled');
            } catch (error) {
                console.error('Error enabling cloud sync:', error);
            }
        }
    }

    disableCloudSync() {
        this.supabase = null;
        console.log('Cloud sync disabled');
    }

    // PIN functions
    async showPinSetupDialog() {
        const pin = prompt('請設定 4-6 位數字密碼:');
        if (pin && pin.length >= 4 && pin.length <= 6 && /^\d+$/.test(pin)) {
            const encoder = new TextEncoder();
            const data = encoder.encode(pin);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            await db.setPin(hashHex);
            console.log('PIN set successfully');
        } else {
            document.getElementById('pinLockToggle').checked = false;
        }
    }

    async disablePinLock() {
        await db.clearPin();
        console.log('PIN lock disabled');
    }

    // Receipt scanning
    async scanReceipt() {
        document.getElementById('receiptFileInput').click();
    }

    async handleReceiptFile(file) {
        if (!file) return;

        try {
            // Use Tesseract.js for OCR
            const result = await Tesseract.recognize(file, 'eng', {
                logger: m => console.log(m)
            });

            // Extract amount from OCR text
            const amount = this.extractAmountFromText(result.data.text);
            if (amount) {
                document.getElementById('transactionAmount').value = amount;
            }

            console.log('OCR Result:', result.data.text);
        } catch (error) {
            console.error('Error scanning receipt:', error);
            alert('掃描失敗，請重試。');
        }
    }

    extractAmountFromText(text) {
        // Simple regex to extract amounts
        const amountRegex = /\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
        const matches = text.match(amountRegex);
        
        if (matches && matches.length > 0) {
            // Remove commas and convert to number
            return parseFloat(matches[0].replace(/[$,]/g, ''));
        }
        
        return null;
    }

    // Export/Import functions
    async exportData() {
        try {
            const data = await db.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `expense-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
        }
    }

    async importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    await db.importData(data);
                    this.updateAllData();
                    alert('資料匯入成功！');
                } catch (error) {
                    console.error('Error importing data:', error);
                    alert('匯入失敗，請檢查檔案格式。');
                }
            }
        };
        input.click();
    }
}

// Global functions for HTML event handlers
function startApp() {
    app.showMainApp();
}

function openAddTransaction(date = null) {
    const sheet = document.getElementById('addTransactionSheet');
    sheet.classList.add('open');
    
    if (date) {
        document.getElementById('transactionDate').value = date.toISOString().slice(0, 10);
    } else {
        document.getElementById('transactionDate').value = new Date().toISOString().slice(0, 10);
    }
    
    app.updateCategoryOptions();
}

function closeAddTransaction() {
    const sheet = document.getElementById('addTransactionSheet');
    sheet.classList.remove('open');
    
    // Clear form
    document.getElementById('transactionAmount').value = '';
    document.getElementById('transactionNote').value = '';
    document.getElementById('transactionCategory').selectedIndex = 0;
    document.getElementById('editTransactionId').value = '';
    document.getElementById('transactionSheetTitle').textContent = '新增交易';
    document.getElementById('deleteTransactionBtn').style.display = 'none';
}

// 編輯交易
function editTransaction(transaction) {
    console.log('editTransaction called with:', transaction);
    console.log('Transaction ID:', transaction.id, 'Type:', typeof transaction.id);
    
    const idInput = document.getElementById('editTransactionId');
    if (!idInput) {
        console.error('editTransactionId input not found!');
        return;
    }
    
    idInput.value = String(transaction.id);
    console.log('Set editTransactionId to:', idInput.value);
    
    document.getElementById('transactionSheetTitle').textContent = '編輯交易';
    document.getElementById('transactionAmount').value = transaction.amount;
    document.getElementById('transactionNote').value = transaction.note || '';
    document.getElementById('transactionDate').value = transaction.date;
    document.getElementById('deleteTransactionBtn').style.display = 'block';
    
    // Set transaction type
    app.transactionType = transaction.type;
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === transaction.type) {
            btn.classList.add('active');
        }
    });
    
    // Update categories and select the right one
    app.updateCategoryOptions().then(() => {
        document.getElementById('transactionCategory').value = transaction.category;
    });
    
    // Open sheet
    document.getElementById('addTransactionSheet').classList.add('open');
}

// 刪除交易
async function deleteTransaction() {
    const id = document.getElementById('editTransactionId').value;
    console.log('Delete transaction called, id:', id);
    
    if (!id) {
        console.error('No transaction ID found');
        alert('找不到交易 ID');
        return;
    }
    
    if (confirm('確定要刪除這筆交易嗎？')) {
        try {
            console.log('Deleting transaction with id:', id);
            await db.deleteTransaction(id);
            console.log('Transaction deleted successfully');
            closeAddTransaction();
            await app.updateAllData();
            alert('已刪除');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('刪除失敗：' + error.message);
        }
    }
}

async function saveTransaction() {
    try {
        const editId = document.getElementById('editTransactionId').value;
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const category = document.getElementById('transactionCategory').value;
        const note = document.getElementById('transactionNote').value;
        const date = document.getElementById('transactionDate').value;
        const type = app.transactionType;

        if (!amount || !category || !date) {
            alert('請填寫所有必填欄位');
            return;
        }

        const transaction = {
            date,
            type,
            amount,
            category,
            note
        };

        if (editId) {
            // 更新現有交易
            await db.updateTransaction(parseInt(editId), transaction);
        } else {
            // 新增交易
            await db.addTransaction(transaction);
        }
        
        closeAddTransaction();
        app.updateAllData();
        
        console.log('Transaction saved successfully');
    } catch (error) {
        console.error('Error saving transaction:', error);
        alert('儲存失敗，請重試。');
    }
}

function previousMonth() {
    const year = app.currentMonth.getFullYear();
    const month = app.currentMonth.getMonth();
    app.currentMonth = new Date(year, month - 1, 1);
    app.updateCalendarGrid();
}

function nextMonth() {
    const year = app.currentMonth.getFullYear();
    const month = app.currentMonth.getMonth();
    app.currentMonth = new Date(year, month + 1, 1);
    app.updateCalendarGrid();
}

function addPinDigit(digit) {
    const input = document.getElementById('pinInput');
    input.value += digit;
    if (input.value.length === 6) {
        app.verifyPin(input.value);
    }
}

function clearPin() {
    document.getElementById('pinInput').value = '';
}

function deletePinDigit() {
    const input = document.getElementById('pinInput');
    input.value = input.value.slice(0, -1);
}

function showCategoriesDialog() {
    document.getElementById('categoriesModal').style.display = 'flex';
    loadCategoriesForManagement();
}

function closeCategoriesDialog() {
    document.getElementById('categoriesModal').style.display = 'none';
}

function showChangePinDialog() {
    document.getElementById('changePinModal').style.display = 'flex';
}

function closeChangePinDialog() {
    document.getElementById('changePinModal').style.display = 'none';
    // Clear form
    document.getElementById('currentPin').value = '';
    document.getElementById('newPin').value = '';
    document.getElementById('confirmNewPin').value = '';
}

async function changePin() {
    const currentPin = document.getElementById('currentPin').value;
    const newPin = document.getElementById('newPin').value;
    const confirmNewPin = document.getElementById('confirmNewPin').value;

    if (!currentPin || !newPin || !confirmNewPin) {
        alert('請填寫所有欄位');
        return;
    }

    if (newPin !== confirmNewPin) {
        alert('新密碼不一致');
        return;
    }

    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
        alert('密碼必須是 4-6 位數字');
        return;
    }

    try {
        const isValid = await app.verifyPinHash(currentPin, (await db.getPin()).hash);
        if (isValid) {
            const encoder = new TextEncoder();
            const data = encoder.encode(newPin);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            await db.setPin(hashHex);
            closeChangePinDialog();
            alert('密碼變更成功');
        } else {
            alert('目前密碼錯誤');
        }
    } catch (error) {
        console.error('Error changing PIN:', error);
        alert('變更密碼失敗，請重試。');
    }
}

async function loadCategoriesForManagement() {
    try {
        const categories = await db.getCategories();
        const container = document.getElementById('categoriesListManagement');
        container.innerHTML = '';

        categories.forEach(category => {
            const item = document.createElement('div');
            item.className = 'category-management-item';
            item.innerHTML = `
                <span>${category.icon} ${category.name}</span>
                <button class="delete-category-btn" onclick="deleteCategory('${category.id}')">刪除</button>
            `;
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading categories for management:', error);
    }
}

let selectedCategoryIcon = '😀';

function toggleIconPicker() {
    const picker = document.getElementById('iconPicker');
    picker.style.display = picker.style.display === 'none' ? 'grid' : 'none';
}

function selectIcon(icon) {
    selectedCategoryIcon = icon;
    document.getElementById('selectedIconBtn').textContent = icon;
    document.getElementById('iconPicker').style.display = 'none';
}

async function addCategory() {
    const name = document.getElementById('newCategoryName').value;
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    
    if (!name) {
        alert('請輸入分類名稱');
        return;
    }

    try {
        const category = {
            name,
            type: activeTab,
            icon: selectedCategoryIcon
        };

        await db.addCategory(category);
        document.getElementById('newCategoryName').value = '';
        selectedCategoryIcon = '😀';
        document.getElementById('selectedIconBtn').textContent = '😀';
        loadCategoriesForManagement();
        app.updateCategoryOptions();
    } catch (error) {
        console.error('Error adding category:', error);
        alert('新增分類失敗，請重試。');
    }
}

async function deleteCategory(id) {
    if (confirm('確定要刪除此分類嗎？')) {
        try {
            await db.deleteCategory(id);
            loadCategoriesForManagement();
            app.updateCategoryOptions();
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('刪除分類失敗，請重試。');
        }
    }
}

function exportData() {
    app.exportData();
}

function importData() {
    app.importData();
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ExpenseTracker();
});

// Service Worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
