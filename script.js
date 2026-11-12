// --- FIREBASE SETUP ---
const firebaseConfig = {
    apiKey: "AAPKI_API_KEY",
    authDomain: "AAPKA_PROJECT.firebaseapp.com",
    projectId: "AAPKA_PROJECT",
    storageBucket: "AAPKA_PROJECT.appspot.com",
    messagingSenderId: "123456789",
    appId: "AAPKI_APP_ID"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- STATE & DATA MANAGEMENT ---
let isAdmin = false;
let adminUid = null;

// DEFAULT BLANK DATA (Jo har naye Demo user ko dikhega)
const defaultWallets = ['Cash', 'Paytm', 'FamPay'];
const defaultExpCats = [
    {name: 'Food', icon: '🍔'}, {name: 'Shopping', icon: '🛍️'}, {name: 'Travel', icon: '🚕'}, {name: 'Bills', icon: '🧾'}
];
const defaultIncCats = [
    {name: 'Salary', icon: '💰'}, {name: 'Allowance', icon: '💵'}, {name: 'Gift', icon: '🎁'}
];

// LIVE VARIABLES (Inme data tab aayega jab user mode select karega)
let transactions = [];
let userWallets = [];
let expCats = [];
let incCats = [];

let selectedCategoryString = "";
let selectedWalletString = "";
let selectedTransactionIds = []; 
let editingTransactionId = null; 

const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const homePage = document.getElementById('home-page');
const addPage = document.getElementById('add-page');
const navHome = document.getElementById('nav-home');
const navAdd = document.getElementById('nav-add');
const entryForm = document.getElementById('entry-form');
const transactionsList = document.getElementById('transactions-list');
const categoryGrid = document.getElementById('category-grid');
const walletGrid = document.getElementById('wallet-grid');
const typeRadios = document.querySelectorAll('input[name="type"]');
const dateInput = document.getElementById('date');
const actionBar = document.getElementById('action-bar');
const editBtn = document.getElementById('edit-btn');
const selectAllCb = document.getElementById('select-all-cb');
const welcomeScreen = document.getElementById('welcome-screen');
const mainAppContent = document.getElementById('main-app-content');

// ----------------- LOGIN / AUTH LOGIC -----------------

// Auto-check on load (Agar Admin pehle se login tha)
auth.onAuthStateChanged((user) => {
    if (user) {
        isAdmin = true;
        adminUid = user.uid;
        document.getElementById('sync-badge').innerText = "Live Sync 🟢";
        document.getElementById('sync-badge').style.background = "#d1fae5";
        document.getElementById('sync-badge').style.color = "#059669";
        document.getElementById('welcome-text').innerText = "Welcome back, Admin!";
        
        // Fetch ADMIN data strictly from Firebase
        db.collection("passbook_data").doc(adminUid).get().then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                transactions = data.transactions || [];
                userWallets = data.wallets || [...defaultWallets];
                expCats = data.expCats || [...defaultExpCats];
                incCats = data.incCats || [...defaultIncCats];
            } else {
                // Pehli baar Admin login
                transactions = [];
                userWallets = [...defaultWallets];
                expCats = [...defaultExpCats];
                incCats = [...defaultIncCats];
            }
            initApp();
        });
    }
});

// START DEMO MODE
window.startDemoMode = function() {
    isAdmin = false;
    adminUid = null;
    document.getElementById('sync-badge').innerText = "Demo Mode";
    document.getElementById('sync-badge').style.background = "#fee2e2";
    document.getElementById('sync-badge').style.color = "#ef4444";
    document.getElementById('welcome-text').innerText = "Testing Demo...";
    
    // NAYA: Use sessionStorage for strictly temporary, per-tab isolated data!
    transactions = JSON.parse(sessionStorage.getItem('demo_data')) || [];
    userWallets = JSON.parse(sessionStorage.getItem('demo_wallets')) || [...defaultWallets];
    expCats = JSON.parse(sessionStorage.getItem('demo_exp_cats')) || [...defaultExpCats];
    incCats = JSON.parse(sessionStorage.getItem('demo_inc_cats')) || [...defaultIncCats];
    
    initApp();
}

window.startAdminMode = function() {
    const email = document.getElementById('admin-email').value.trim();
    const pass = document.getElementById('admin-pass').value.trim();
    if(!email || !pass) return alert("Please enter Email and Password");
    
    auth.signInWithEmailAndPassword(email, pass).catch((error) => {
        alert("Login Failed: " + error.message);
    });
}

window.logout = function() {
    if(isAdmin) {
        if(confirm("Logout from Admin account?")) auth.signOut();
    } else {
        if(confirm("Exit Demo Mode?")) {
            sessionStorage.clear(); // Clear all demo data for this session
            location.reload();
        }
    }
}

function initApp() {
    welcomeScreen.style.display = 'none';
    mainAppContent.style.display = 'block';
    renderWalletGrid();
    renderCategoryGrid();
    dateInput.value = getTodayDate(); 
    updateUI();
}

// ----------------- MASTER SAVE FUNCTION -----------------
function saveAllData() {
    if (isAdmin && adminUid) {
        // Save ONLY to Firebase
        db.collection("passbook_data").doc(adminUid).set({
            transactions: transactions,
            wallets: userWallets,
            expCats: expCats,
            incCats: incCats,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.error("Error saving to Firebase:", err));
    } else {
        // Save ONLY to current tab's SessionStorage (No impact on other users)
        sessionStorage.setItem('demo_data', JSON.stringify(transactions));
        sessionStorage.setItem('demo_wallets', JSON.stringify(userWallets));
        sessionStorage.setItem('demo_exp_cats', JSON.stringify(expCats));
        sessionStorage.setItem('demo_inc_cats', JSON.stringify(incCats));
    }
}

// Utilities
const getTodayDate = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const reverseDateString = (displayStr) => {
    let d = new Date(displayStr);
    if(isNaN(d)) d = new Date(displayStr + " " + new Date().getFullYear());
    if(isNaN(d)) return getTodayDate();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const formatMoney = (amount) => "₹ " + amount.toLocaleString('en-IN');

// ----------------- CUSTOM MODALS LOGIC -----------------
const customModal = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalInputName = document.getElementById('modal-input-name');
const modalInputEmoji = document.getElementById('modal-input-emoji');
const modalEmojiGroup = document.getElementById('modal-emoji-group');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');
let currentModalCallback = null;

function openCustomModal(title, showEmoji, callback) {
    modalTitle.innerText = title;
    modalInputName.value = '';
    modalInputEmoji.value = '';
    modalEmojiGroup.style.display = showEmoji ? 'block' : 'none';
    currentModalCallback = callback;
    customModal.style.display = 'flex';
    modalInputName.focus();
}

function closeCustomModal() {
    customModal.style.display = 'none';
    currentModalCallback = null;
}

modalCancelBtn.onclick = (e) => { e.preventDefault(); closeCustomModal(); };

modalSaveBtn.onclick = (e) => {
    e.preventDefault();
    const name = modalInputName.value.trim();
    const emoji = modalInputEmoji.value.trim() || '📝'; 
    if (!name) return alert("Name cannot be empty!");
    if (currentModalCallback) currentModalCallback(name, emoji);
    closeCustomModal();
};

// ----------------- ADVANCED EXPORT MODAL LOGIC -----------------
const exportModal = document.getElementById('export-modal');
let exportSelectedWallets = [];
let exportSelectedCategories = [];

window.toggleCustomDate = function() {
    const val = document.getElementById('export-timeframe').value;
    const customDiv = document.getElementById('custom-date-range');
    customDiv.style.display = val === 'custom' ? 'flex' : 'none';
}

function updateExportCategories() {
    const selectedType = document.querySelector('input[name="export-type"]:checked').value;
    const catContainer = document.getElementById('export-category-list');
    catContainer.innerHTML = '';
    exportSelectedCategories = []; 

    let catsToIterate = [];
    if (selectedType === 'all') catsToIterate = [...expCats, ...incCats];
    else if (selectedType === 'income') catsToIterate = incCats;
    else catsToIterate = expCats;

    const uniqueCatNames = [...new Set(catsToIterate.map(c => c.name))];
    uniqueCatNames.forEach(c => {
        const pill = document.createElement('div');
        pill.className = 'filter-pill';
        pill.innerText = c;
        pill.onclick = () => {
            pill.classList.toggle('active');
            if(exportSelectedCategories.includes(c)) exportSelectedCategories = exportSelectedCategories.filter(x => x !== c);
            else exportSelectedCategories.push(c);
        };
        catContainer.appendChild(pill);
    });
}

document.querySelectorAll('input[name="export-type"]').forEach(radio => radio.addEventListener('change', updateExportCategories));

window.openExportModal = () => { 
    exportSelectedWallets = [];
    const walletContainer = document.getElementById('export-wallet-list');
    walletContainer.innerHTML = '';
    userWallets.forEach(w => {
        const pill = document.createElement('div');
        pill.className = 'filter-pill';
        pill.innerText = w;
        pill.onclick = () => {
            pill.classList.toggle('active');
            if(exportSelectedWallets.includes(w)) exportSelectedWallets = exportSelectedWallets.filter(x => x !== w);
            else exportSelectedWallets.push(w);
        };
        walletContainer.appendChild(pill);
    });

    document.getElementById('exp-type-all').checked = true;
    document.getElementById('export-timeframe').value = 'all'; 
    toggleCustomDate(); 
    updateExportCategories();

    exportModal.style.display = 'flex'; 
};
window.closeExportModal = () => { exportModal.style.display = 'none'; };

// ----------------- WALLET GRID LOGIC -----------------
function renderWalletGrid() {
    walletGrid.innerHTML = '';
    if (!userWallets.includes(selectedWalletString)) selectedWalletString = userWallets[0];

    userWallets.forEach(wallet => {
        const box = document.createElement('div');
        box.className = 'cat-box' + (wallet === selectedWalletString ? ' active' : '');
        box.innerHTML = `<span class="cat-icon" style="font-size:18px;">💳</span><span class="cat-name">${wallet}</span>`;
        
        const delBtn = document.createElement('div');
        delBtn.className = 'delete-badge';
        delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        delBtn.onclick = (e) => {
            e.stopPropagation(); 
            if(userWallets.length === 1) return alert("You must keep at least 1 wallet!");
            if(confirm(`Remove wallet '${wallet}'?`)) {
                userWallets = userWallets.filter(w => w !== wallet);
                saveAllData(); 
                renderWalletGrid();
                updateUI();
            }
        };
        box.appendChild(delBtn);
        
        box.onclick = () => {
            document.querySelectorAll('#wallet-grid .cat-box').forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            selectedWalletString = wallet;
        };
        walletGrid.appendChild(box);
    });

    const addBox = document.createElement('div');
    addBox.className = 'cat-box add-cat-box';
    addBox.innerHTML = `<span class="cat-icon" style="font-size:20px;">➕</span><span class="cat-name">Add New</span>`;
    addBox.onclick = () => {
        openCustomModal("Add New Wallet", false, (name) => {
            userWallets.push(name);
            saveAllData(); 
            selectedWalletString = name; 
            renderWalletGrid();
            updateUI(); 
        });
    };
    walletGrid.appendChild(addBox);
}

// ----------------- CATEGORY GRID LOGIC -----------------
function renderCategoryGrid() {
    const type = document.querySelector('input[name="type"]:checked').value;
    categoryGrid.innerHTML = '';
    let catsToShow = type === 'expense' ? expCats : incCats;
    
    if (!editingTransactionId && catsToShow.length > 0) {
        selectedCategoryString = catsToShow[0].name + ' ' + catsToShow[0].icon;
    }

    catsToShow.forEach((cat) => {
        const catFullString = cat.name + ' ' + cat.icon;
        const box = document.createElement('div');
        box.className = 'cat-box' + (catFullString === selectedCategoryString ? ' active' : '');
        box.innerHTML = `<span class="cat-icon">${cat.icon}</span><span class="cat-name">${cat.name}</span>`;

        const delBtn = document.createElement('div');
        delBtn.className = 'delete-badge';
        delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if(catsToShow.length === 1) return alert("You must keep at least 1 category!");
            if(confirm(`Remove category '${cat.name}'?`)) {
                if(type === 'expense') expCats = expCats.filter(c => c.name !== cat.name);
                else incCats = incCats.filter(c => c.name !== cat.name);
                saveAllData(); 
                renderCategoryGrid();
            }
        };
        box.appendChild(delBtn);
        
        box.onclick = () => {
            document.querySelectorAll('#category-grid .cat-box').forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            selectedCategoryString = catFullString;
        };
        categoryGrid.appendChild(box);
    });

    const addBox = document.createElement('div');
    addBox.className = 'cat-box add-cat-box';
    addBox.innerHTML = `<span class="cat-icon" style="font-size:20px;">➕</span><span class="cat-name">Add New</span>`;
    addBox.onclick = () => {
        openCustomModal("Add New Category", true, (name, emoji) => {
            if (type === 'expense') expCats.push({name, icon: emoji});
            else incCats.push({name, icon: emoji});
            saveAllData(); 
            renderCategoryGrid();
        });
    };
    categoryGrid.appendChild(addBox);
}

typeRadios.forEach(radio => radio.addEventListener('change', renderCategoryGrid));

// ----------------- TAB SWITCHING & UI LOGIC -----------------
function openAddPage() {
    homePage.style.display = 'none';
    addPage.style.display = 'block';
    navHome.classList.remove('active');
    navAdd.classList.add('active');
}

function openHomePage() {
    addPage.style.display = 'none';
    homePage.style.display = 'block';
    navAdd.classList.remove('active');
    navHome.classList.add('active');
    
    entryForm.reset();
    editingTransactionId = null;
    document.getElementById('form-title').innerText = "New Entry";
    document.getElementById('submit-btn').innerText = "Save Entry";
    dateInput.value = getTodayDate();
    renderWalletGrid();
    renderCategoryGrid();
    
    selectedTransactionIds = [];
    updateUI();
}

navAdd.addEventListener('click', (e) => { e.preventDefault(); openAddPage(); });
navHome.addEventListener('click', (e) => { e.preventDefault(); openHomePage(); });

window.toggleSelection = function(id) {
    if(selectedTransactionIds.includes(id)) selectedTransactionIds = selectedTransactionIds.filter(tid => tid !== id);
    else selectedTransactionIds.push(id);
    updateUI();
}

window.toggleSelectAll = function() {
    if(selectedTransactionIds.length === transactions.length && transactions.length > 0) selectedTransactionIds = []; 
    else selectedTransactionIds = transactions.map(t => t.id); 
    updateUI();
}

function updateActionBar() {
    if(selectedTransactionIds.length > 0) {
        actionBar.style.display = 'flex';
        editBtn.style.display = selectedTransactionIds.length === 1 ? 'flex' : 'none';
        selectAllCb.checked = (selectedTransactionIds.length === transactions.length);
    } else {
        actionBar.style.display = 'none';
        selectAllCb.checked = false;
    }
}

window.deleteSelectedEntries = function() {
    if(confirm(`Are you sure you want to delete ${selectedTransactionIds.length} entry(s)?`)) {
        transactions = transactions.filter(t => !selectedTransactionIds.includes(t.id));
        saveAllData(); 
        selectedTransactionIds = [];
        updateUI();
    }
}

window.editSelectedEntry = function() {
    const t = transactions.find(t => t.id === selectedTransactionIds[0]);
    if(!t) return;

    editingTransactionId = t.id;
    openAddPage();
    
    document.getElementById('form-title').innerText = "Edit Entry";
    document.getElementById('submit-btn').innerText = "Update Entry";
    
    document.getElementById('type-' + t.type).checked = true;
    document.getElementById('amount').value = t.amount;
    document.getElementById('desc').value = t.desc;
    document.getElementById('date').value = reverseDateString(t.date);
    
    selectedWalletString = t.wallet;
    selectedCategoryString = t.category;
    
    renderWalletGrid();
    renderCategoryGrid();
}

const getIconHTML = (type, emoji) => {
    const colorClass = type === 'income' ? 'income-icon' : 'expense-icon';
    return `<div class="icon ${colorClass}" style="font-size: 20px;">${emoji}</div>`;
};

function updateUI() {
    let totalIncome = 0; let totalExpense = 0;
    let walletBalances = {};
    userWallets.forEach(w => walletBalances[w] = 0);

    transactionsList.innerHTML = ''; 
    transactions.sort((a, b) => new Date(reverseDateString(b.date)) - new Date(reverseDateString(a.date)));

    if(transactions.length === 0) transactionsList.innerHTML = '<p class="empty-msg">No entries found.</p>';

    transactions.forEach(t => {
        let amt = parseFloat(t.amount);
        if (t.type === 'income') {
            totalIncome += amt;
            if(userWallets.includes(t.wallet)) walletBalances[t.wallet] += amt;
        } else {
            totalExpense += amt;
            if(userWallets.includes(t.wallet)) walletBalances[t.wallet] -= amt;
        }

        const isChecked = selectedTransactionIds.includes(t.id);
        const sign = t.type === 'income' ? '+' : '-';
        const colorClass = t.type === 'income' ? 'income' : 'expense';
        const parts = t.category.split(' ');
        const emoji = parts.length > 1 ? parts.pop() : (t.type === 'income' ? '💰' : '💸'); 
        const catName = parts.join(' ') || t.category;
        
        let displayDate = t.date;
        const currentYearStr = new Date().getFullYear().toString();
        if(displayDate.includes(currentYearStr)) displayDate = displayDate.replace(' ' + currentYearStr, '');

        const item = document.createElement('div');
        item.className = 'transaction-item' + (isChecked ? ' selected' : '');
        item.innerHTML = `
            <div class="trans-left">
                <input type="checkbox" class="custom-cb" ${isChecked ? 'checked' : ''} onchange="toggleSelection(${t.id})">
                ${getIconHTML(t.type, emoji)}
                <div class="trans-info">
                    <h4>${t.desc}</h4>
                    <p>${catName} • ${t.wallet}</p>
                </div>
            </div>
            <div class="trans-right">
                <h4 class="${colorClass}">${sign} ₹ ${amt.toLocaleString('en-IN')}</h4>
                <p>${displayDate}</p>
            </div>
        `;
        item.onclick = (e) => { if(e.target.tagName !== 'INPUT') toggleSelection(t.id); };
        transactionsList.appendChild(item);
    });

    const walletsContainer = document.getElementById('wallets-container');
    walletsContainer.innerHTML = '';
    userWallets.forEach((w, index) => {
        const card = document.createElement('div');
        card.className = 'wallet-card';
        card.style.borderLeft = `4px solid ${colors[index % colors.length]}`;
        card.innerHTML = `<p>${w}</p><h4>₹ ${(walletBalances[w] || 0).toLocaleString('en-IN')}</h4>`;
        walletsContainer.appendChild(card);
    });

    document.getElementById('total-balance').innerText = formatMoney(totalIncome - totalExpense);
    document.getElementById('total-income').innerText = formatMoney(totalIncome);
    document.getElementById('total-expense').innerText = formatMoney(totalExpense);
    updateActionBar();
}

entryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedCategoryString || !selectedWalletString) return alert("Please select both Wallet and Category!");

    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = document.getElementById('amount').value;
    const desc = document.getElementById('desc').value;
    const dateObj = new Date(document.getElementById('date').value);
    const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const transactionData = {
        id: editingTransactionId ? editingTransactionId : Date.now(),
        type, amount, wallet: selectedWalletString, category: selectedCategoryString, desc, date: dateStr
    };

    if (editingTransactionId) {
        const idx = transactions.findIndex(t => t.id === editingTransactionId);
        transactions[idx] = transactionData;
    } else {
        transactions.unshift(transactionData);
    }
    
    saveAllData(); 
    openHomePage();
});

window.clearData = function() {
    if(confirm("Delete ALL entries permanently?")) {
        transactions = [];
        saveAllData(); 
        selectedTransactionIds = [];
        updateUI();
    }
}

// ----------------- ADVANCED FILTER EXPORT TO PDF -----------------
window.generatePDF = function() {
    if (typeof window.jspdf === 'undefined') return alert("Loading PDF engine, please wait a second.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const timeframe = document.getElementById('export-timeframe').value;
    const filterType = document.querySelector('input[name="export-type"]:checked').value;
    
    let sDate = null, eDate = null;
    if(timeframe === 'custom') {
        const sdStr = document.getElementById('export-start-date').value;
        const edStr = document.getElementById('export-end-date').value;
        if(!sdStr || !edStr) return alert("Please select both Start and End dates for Custom Range.");
        sDate = new Date(sdStr);
        eDate = new Date(edStr);
        eDate.setHours(23,59,59,999); 
    }
    
    const now = new Date();
    
    let filteredTransactions = transactions.filter(t => {
        const tDate = new Date(reverseDateString(t.date));

        if(timeframe === 'custom') {
            if (tDate < sDate || tDate > eDate) return false;
        } else if (timeframe !== 'all') {
            const monthsDiff = (now.getFullYear() - tDate.getFullYear()) * 12 + (now.getMonth() - tDate.getMonth());
            if (monthsDiff > parseInt(timeframe)) return false;
        }

        if (filterType !== 'all' && t.type !== filterType) return false;
        if (exportSelectedWallets.length > 0 && !exportSelectedWallets.includes(t.wallet)) return false;
        const catNameOnly = t.category.split(' ').slice(0, -1).join(' ') || t.category;
        if (exportSelectedCategories.length > 0 && !exportSelectedCategories.includes(catNameOnly)) return false;

        return true;
    });

    if (filteredTransactions.length === 0) {
        alert("No entries found for the selected filters.");
        return;
    }

    let sortedForDates = [...filteredTransactions].sort((a, b) => new Date(reverseDateString(a.date)) - new Date(reverseDateString(b.date)));
    let startDateStr = sortedForDates[0].date;
    let endDateStr = sortedForDates[sortedForDates.length - 1].date;
    let periodText = startDateStr === endDateStr ? startDateStr : `${startDateStr} to ${endDateStr}`;

    let sumIncome = 0; let sumExpense = 0;
    filteredTransactions.forEach(t => {
        if (t.type === 'income') sumIncome += parseFloat(t.amount);
        else sumExpense += parseFloat(t.amount);
    });
    const netBalance = sumIncome - sumExpense;

    let filtersUsed = [];
    if(filterType !== 'all') filtersUsed.push(`Type: ${filterType.toUpperCase()}`);
    if(exportSelectedWallets.length > 0) filtersUsed.push(`Wallets: ${exportSelectedWallets.join(', ')}`);
    if(exportSelectedCategories.length > 0) filtersUsed.push(`Categories: ${exportSelectedCategories.join(', ')}`);
    const filtersDisplayString = filtersUsed.length > 0 ? "Filters applied: " + filtersUsed.join(' | ') : "Filters applied: None";

    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55); 
    doc.text("Account Statement", 14, 22);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128); 
    doc.text(`Generated on: ${now.toLocaleDateString('en-IN')}  |  Period: ${periodText}`, 14, 30);
    
    doc.setFontSize(8);
    const splitFilters = doc.splitTextToSize(filtersDisplayString, 180);
    doc.text(splitFilters, 14, 35);

    let offset = splitFilters.length > 1 ? (splitFilters.length - 1) * 4 : 0;

    doc.setDrawColor(59, 130, 246); 
    doc.setLineWidth(0.5);
    doc.line(14, 39 + offset, 196, 39 + offset); 

    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, 45 + offset, 182, 22, 2, 2, 'FD'); 
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246); 
    doc.text("Total Income: Rs. " + sumIncome.toLocaleString('en-IN'), 20, 58 + offset);
    
    doc.setTextColor(239, 68, 68);
    doc.text("Total Expense: Rs. " + sumExpense.toLocaleString('en-IN'), 85, 58 + offset);
    
    doc.setTextColor(netBalance >= 0 ? 16 : 239, netBalance >= 0 ? 185 : 68, netBalance >= 0 ? 129 : 68);
    doc.text("Net Balance: Rs. " + netBalance.toLocaleString('en-IN'), 150, 58 + offset);

    const tableBody = filteredTransactions.map(t => {
        const catName = t.category.split(' ').slice(0, -1).join(' ') || t.category;
        const amtStr = parseFloat(t.amount).toLocaleString('en-IN');
        const incomeCell = t.type === 'income' ? `+ ${amtStr}` : '';
        const expenseCell = t.type === 'expense' ? `- ${amtStr}` : '';
        return [t.date, t.desc, catName, t.wallet, incomeCell, expenseCell];
    });

    doc.autoTable({
        startY: 75 + offset,
        head: [['Date', 'Description', 'Category', 'Source', 'Income (Rs)', 'Expense (Rs)']],
        body: tableBody,
        theme: 'striped', 
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { textColor: [55, 65, 81], fontSize: 9, valign: 'middle' },
        alternateRowStyles: { fillColor: [243, 244, 246] },
        columnStyles: {
            0: { cellWidth: 26 }, 1: { cellWidth: 55 }, 2: { cellWidth: 22 }, 
            3: { cellWidth: 20 }, 4: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129], cellWidth: 30 }, 
            5: { halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68], cellWidth: 30 }  
        },
        didDrawPage: function (data) {
            let str = 'Page ' + doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175); 
            doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
            doc.text("Generated by Digital Passbook", 150, doc.internal.pageSize.height - 10);
        }
    });

    doc.save(`Account_Statement_${now.getTime()}.pdf`);
    closeExportModal();
}