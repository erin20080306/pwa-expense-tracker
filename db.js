// IndexedDB Database Manager
class ExpenseDB {
    constructor() {
        this.dbName = 'ExpenseTrackerDB';
        this.dbVersion = 2;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                reject('Database error: ' + event.target.errorCode);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Transactions store
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    transactionStore.createIndex('date', 'date', { unique: false });
                    transactionStore.createIndex('type', 'type', { unique: false });
                    transactionStore.createIndex('category', 'category', { unique: false });
                }

                // Categories store
                if (!db.objectStoreNames.contains('categories')) {
                    const categoryStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
                    categoryStore.createIndex('type', 'type', { unique: false });
                }

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Budget store
                if (!db.objectStoreNames.contains('budgets')) {
                    db.createObjectStore('budgets', { keyPath: 'id', autoIncrement: true });
                }

                // PIN store (for security)
                if (!db.objectStoreNames.contains('pin')) {
                    db.createObjectStore('pin', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // Transaction operations
    async addTransaction(transaction) {
        const transactionData = {
            ...transaction,
            createdAt: new Date().toISOString(),
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            const request = store.add(transactionData);

            request.onsuccess = () => resolve(transactionData);
            request.onerror = () => reject(request.error);
        });
    }

    async updateTransaction(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const existing = getRequest.result;
                if (existing) {
                    const updated = { ...existing, ...updates };
                    const updateRequest = store.put(updated);
                    updateRequest.onsuccess = () => resolve(updated);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject('Transaction not found');
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteTransaction(id) {
        return new Promise((resolve, reject) => {
            console.log('DB deleteTransaction called with id:', id, 'type:', typeof id);
            
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            
            // 直接使用原始 ID（可能是字串或數字）
            console.log('Deleting with id:', id);
            
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('Delete request succeeded');
                resolve();
            };
            request.onerror = () => {
                console.error('Delete request failed:', request.error);
                reject(request.error);
            };
            
            transaction.oncomplete = () => {
                console.log('Delete transaction completed');
            };
            transaction.onerror = () => {
                console.error('Delete transaction error:', transaction.error);
            };
        });
    }

    async getTransactions(limit = null, offset = 0) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('date');
            const request = index.openCursor(null, 'prev'); // Get latest first

            const results = [];
            let count = 0;
            let skipped = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && (limit === null || count < limit)) {
                    if (skipped >= offset) {
                        results.push(cursor.value);
                        count++;
                    } else {
                        skipped++;
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getTransactionsByDateRange(startDate, endDate) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('date');
            const range = IDBKeyRange.bound(startDate, endDate);
            const request = index.getAll(range);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getTransactionsByDate(date) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('date');
            const request = index.getAll(date);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Category operations
    async getCategories(type = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readonly');
            const store = transaction.objectStore('categories');
            
            if (type) {
                const index = store.index('type');
                const request = index.getAll(type);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } else {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
        });
    }

    async addCategory(category) {
        const categoryData = {
            ...category,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readwrite');
            const store = transaction.objectStore('categories');
            const request = store.add(categoryData);

            request.onsuccess = () => resolve(categoryData);
            request.onerror = () => reject(request.error);
        });
    }

    async updateCategory(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readwrite');
            const store = transaction.objectStore('categories');
            
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const existing = getRequest.result;
                if (existing) {
                    const updated = { ...existing, ...updates };
                    const updateRequest = store.put(updated);
                    updateRequest.onsuccess = () => resolve(updated);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject('Category not found');
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteCategory(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readwrite');
            const store = transaction.objectStore('categories');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Settings operations
    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }

    async setSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Budget operations
    async getBudget(month = null) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['budgets'], 'readonly');
                const store = transaction.objectStore('budgets');
                
                const request = store.getAll();
                request.onsuccess = () => {
                    const budgets = request.result || [];
                    const targetMonth = month || new Date().toISOString().slice(0, 7);
                    const budget = budgets.find(b => b.month === targetMonth);
                    resolve(budget || { amount: 0, savingsGoal: 0 });
                };
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error('getBudget error:', error);
                resolve({ amount: 0, savingsGoal: 0 });
            }
        });
    }

    async setBudget(month, amount, savingsGoal = 0) {
        const budgetData = { month, amount, savingsGoal };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['budgets'], 'readwrite');
            const store = transaction.objectStore('budgets');
            const request = store.put(budgetData);

            request.onsuccess = () => resolve(budgetData);
            request.onerror = () => reject(request.error);
        });
    }

    // PIN operations
    async getPin() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pin'], 'readonly');
            const store = transaction.objectStore('pin');
            const request = store.getAll();

            request.onsuccess = () => {
                const pins = request.result;
                resolve(pins.length > 0 ? pins[0] : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async setPin(hashedPin) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pin'], 'readwrite');
            const store = transaction.objectStore('pin');
            
            // Clear existing PIN first
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
                const pinData = { id: 1, hash: hashedPin, createdAt: new Date().toISOString() };
                const addRequest = store.add(pinData);
                addRequest.onsuccess = () => resolve(pinData);
                addRequest.onerror = () => reject(addRequest.error);
            };
            clearRequest.onerror = () => reject(clearRequest.error);
        });
    }

    async clearPin() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pin'], 'readwrite');
            const store = transaction.objectStore('pin');
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Statistics operations
    async getStatistics(startDate, endDate) {
        const transactions = await this.getTransactionsByDateRange(startDate, endDate);
        
        const stats = {
            totalIncome: 0,
            totalExpenses: 0,
            incomeByCategory: {},
            expensesByCategory: {},
            dailyData: {}
        };

        transactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount);
            
            if (transaction.type === 'income') {
                stats.totalIncome += amount;
                stats.incomeByCategory[transaction.category] = 
                    (stats.incomeByCategory[transaction.category] || 0) + amount;
            } else {
                stats.totalExpenses += amount;
                stats.expensesByCategory[transaction.category] = 
                    (stats.expensesByCategory[transaction.category] || 0) + amount;
            }

            // Daily data
            if (!stats.dailyData[transaction.date]) {
                stats.dailyData[transaction.date] = { income: 0, expenses: 0 };
            }
            
            if (transaction.type === 'income') {
                stats.dailyData[transaction.date].income += amount;
            } else {
                stats.dailyData[transaction.date].expenses += amount;
            }
        });

        return stats;
    }

    // Export/Import operations
    async exportData() {
        const transactions = await this.getTransactions();
        const categories = await this.getCategories();
        const settings = await this.getAllSettings();
        const budgets = await this.getAllBudgets();

        return {
            transactions,
            categories,
            settings,
            budgets,
            exportedAt: new Date().toISOString()
        };
    }

    async getAllSettings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.getAll();

            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(item => {
                    settings[item.key] = item.value;
                });
                resolve(settings);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAllBudgets() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['budgets'], 'readonly');
            const store = transaction.objectStore('budgets');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async importData(data) {
        return new Promise(async (resolve, reject) => {
            try {
                // Clear existing data
                await this.clearAllData();

                // Import transactions
                if (data.transactions && Array.isArray(data.transactions)) {
                    for (const transaction of data.transactions) {
                        await this.addTransaction(transaction);
                    }
                }

                // Import categories
                if (data.categories && Array.isArray(data.categories)) {
                    for (const category of data.categories) {
                        await this.addCategory(category);
                    }
                }

                // Import settings
                if (data.settings && typeof data.settings === 'object') {
                    for (const [key, value] of Object.entries(data.settings)) {
                        await this.setSetting(key, value);
                    }
                }

                // Import budgets
                if (data.budgets && Array.isArray(data.budgets)) {
                    for (const budget of data.budgets) {
                        await this.setBudget(budget.month, budget.amount, budget.savingsGoal);
                    }
                }

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    async clearAllData() {
        return new Promise((resolve, reject) => {
            const stores = ['transactions', 'categories', 'settings', 'budgets'];
            let completed = 0;
            let hasError = false;

            stores.forEach(storeName => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => {
                    completed++;
                    if (completed === stores.length && !hasError) {
                        resolve();
                    }
                };

                request.onerror = () => {
                    if (!hasError) {
                        hasError = true;
                        reject(request.error);
                    }
                };
            });
        });
    }
}

// Initialize database
const db = new ExpenseDB();

// Default categories with cute icons
const defaultCategories = [
    // Income categories
    { name: '薪水', type: 'income', icon: '🤑' },
    { name: '兼職', type: 'income', icon: '💪' },
    { name: '獎金', type: 'income', icon: '🎉' },
    { name: '投資', type: 'income', icon: '🌱' },
    { name: '紅包', type: 'income', icon: '🧧' },
    { name: '其他收入', type: 'income', icon: '✨' },
    
    // Expense categories
    { name: '餐飲', type: 'expense', icon: '🍜' },
    { name: '飲料', type: 'expense', icon: '🧋' },
    { name: '交通', type: 'expense', icon: '🚌' },
    { name: '購物', type: 'expense', icon: '🛒' },
    { name: '娛樂', type: 'expense', icon: '🎬' },
    { name: '日用品', type: 'expense', icon: '🧴' },
    { name: '醫療', type: 'expense', icon: '💊' },
    { name: '教育', type: 'expense', icon: '📖' },
    { name: '寵物', type: 'expense', icon: '🐱' },
    { name: '美妝', type: 'expense', icon: '💄' },
    { name: '運動', type: 'expense', icon: '🏃' },
    { name: '電話費', type: 'expense', icon: '📱' },
    { name: '水電費', type: 'expense', icon: '💡' },
    { name: '房租', type: 'expense', icon: '🏠' },
    { name: '其他支出', type: 'expense', icon: '📝' }
];

// Initialize default categories (clear old and add new)
async function initializeDefaultCategories() {
    try {
        const existingCategories = await db.getCategories();
        // 清除舊分類並重新載入新的可愛分類
        if (existingCategories.length === 0 || existingCategories.length < 15) {
            // 先清除舊的
            for (const cat of existingCategories) {
                if (cat.id) await db.deleteCategory(cat.id);
            }
            // 新增可愛分類
            for (const category of defaultCategories) {
                await db.addCategory(category);
            }
        }
    } catch (error) {
        console.error('Error initializing default categories:', error);
    }
}

// Initialize sample data if database is empty
async function initializeSampleData() {
    try {
        const transactions = await db.getTransactions(1);
        if (transactions.length === 0) {
            const sampleTransactions = [
                {
                    date: new Date().toISOString().slice(0, 10),
                    type: 'expense',
                    amount: 85,
                    category: '餐飲',
                    note: '午餐便當'
                },
                {
                    date: new Date().toISOString().slice(0, 10),
                    type: 'income',
                    amount: 35000,
                    category: '薪水',
                    note: '本月薪資'
                },
                {
                    date: new Date().toISOString().slice(0, 10),
                    type: 'expense',
                    amount: 55,
                    category: '飲料',
                    note: '手搖飲'
                },
                {
                    date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
                    type: 'expense',
                    amount: 280,
                    category: '交通',
                    note: '加油'
                },
                {
                    date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
                    type: 'expense',
                    amount: 599,
                    category: '購物',
                    note: '網購'
                },
                {
                    date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
                    type: 'expense',
                    amount: 1200,
                    category: '水電費',
                    note: '電費'
                }
            ];

            for (const transaction of sampleTransactions) {
                await db.addTransaction(transaction);
            }
        }
    } catch (error) {
        console.error('Error initializing sample data:', error);
    }
}
