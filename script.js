// State
let accessToken = null;
let tokenExpiry = null;
let isRunning = false;

function addLog(message, type = 'info') {
    const logContainer = document.getElementById('logContainer');
    if (!logContainer) return;
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    div.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    logContainer.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updatePreview() {
    const template = document.getElementById('binderNameTemplate');
    const clientsText = document.getElementById('clientsList');
    const namePreview = document.getElementById('namePreviewText');
    
    if (!template || !clientsText || !namePreview) return;
    
    const templateValue = template.value;
    const firstLine = clientsText.value.split('\n').find(l => l.trim() && l.includes(','));
    
    if (firstLine) {
        const parts = firstLine.split(',');
        const name = parts[1] ? parts[1].trim() : parts[0].split('@')[0];
        const email = parts[0].trim();
        let preview = templateValue.replace(/{{name}}/g, name).replace(/{{email}}/g, email);
        namePreview.innerText = preview;
    } else {
        namePreview.innerText = 'Add client to see preview';
    }
}

function updateCounts() {
    const clientsList = document.getElementById('clientsList');
    const teamList = document.getElementById('teamList');
    const clientCount = document.getElementById('clientCount');
    const teamCount = document.getElementById('teamCount');
    
    if (clientsList && clientCount) {
        const clients = clientsList.value.split('\n').filter(l => l.trim() && l.includes(','));
        clientCount.innerText = `${clients.length} clients`;
    }
    if (teamList && teamCount) {
        const team = teamList.value.split('\n').filter(l => l.trim() && l.includes(','));
        teamCount.innerText = `${team.length} members`;
    }
    updatePreview();
}

function saveConfig() {
    // Safe getElementById with null checks
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    const getChecked = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    };
    
    const config = {
        domain: getVal('domain'),
        orgId: getVal('orgId'),
        clientId: getVal('clientId'),
        clientSecret: getVal('clientSecret'),
        identityType: getVal('identityType'),
        identityValue: getVal('identityValue'),
        binderNameTemplate: getVal('binderNameTemplate'),
        binderDescription: getVal('binderDescription'),
        referenceId: getVal('referenceId'),
        boardOwnerEmail: getVal('boardOwnerEmail'),
        restricted: getChecked('restricted'),
        suppressFeed: getChecked('suppressFeed')
    };
    localStorage.setItem('moxo_binder_config', JSON.stringify(config));
}

function loadSavedData() {
    const saved = localStorage.getItem('moxo_binder_config');
    if (saved) {
        try {
            const c = JSON.parse(saved);
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val || '';
            };
            const setChecked = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.checked = val || false;
            };
            
            setVal('domain', c.domain);
            setVal('orgId', c.orgId);
            setVal('clientId', c.clientId);
            setVal('clientSecret', c.clientSecret);
            setVal('identityType', c.identityType || 'email');
            setVal('identityValue', c.identityValue);
            setVal('binderNameTemplate', c.binderNameTemplate || '{{name}} Workspace');
            setVal('binderDescription', c.binderDescription);
            setVal('referenceId', c.referenceId);
            setVal('boardOwnerEmail', c.boardOwnerEmail);
            setChecked('restricted', c.restricted);
            setChecked('suppressFeed', c.suppressFeed);
        } catch(e) {}
    }
    
    const savedToken = localStorage.getItem('moxo_binder_token');
    if (savedToken) {
        try {
            const t = JSON.parse(savedToken);
            if (new Date(t.expiry) > new Date()) {
                accessToken = t.access_token;
                tokenExpiry = t.expiry;
                const tokenDot = document.getElementById('tokenDot');
                const tokenStatus = document.getElementById('tokenStatus');
                if (tokenDot) tokenDot.classList.add('valid');
                if (tokenStatus) tokenStatus.innerText = 'Token Ready';
            }
        } catch(e) {}
    }
    
    updateCounts();
    attachListeners();
}

function attachListeners() {
    const clientsList = document.getElementById('clientsList');
    const teamList = document.getElementById('teamList');
    const binderNameTemplate = document.getElementById('binderNameTemplate');
    
    if (clientsList) clientsList.addEventListener('input', updateCounts);
    if (teamList) teamList.addEventListener('input', updateCounts);
    if (binderNameTemplate) binderNameTemplate.addEventListener('input', () => {
        updatePreview();
        saveConfig();
    });
    
    const saveFields = ['domain', 'orgId', 'clientId', 'clientSecret', 'identityType', 'identityValue', 
     'binderDescription', 'referenceId', 'boardOwnerEmail'];
    
    saveFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', saveConfig);
    });
    
    const restricted = document.getElementById('restricted');
    const suppressFeed = document.getElementById('suppressFeed');
    if (restricted) restricted.addEventListener('change', saveConfig);
    if (suppressFeed) suppressFeed.addEventListener('change', saveConfig);
    
    const identityType = document.getElementById('identityType');
    if (identityType) {
        identityType.addEventListener('change', function() {
            const type = this.value;
            const label = document.getElementById('identityLabel');
            const input = document.getElementById('identityValue');
            if (type === 'email') {
                if (label) label.innerText = 'Identity Value (Email)';
                if (input) input.placeholder = 'admin@example.com';
            } else if (type === 'unique_id') {
                if (label) label.innerText = 'Identity Value (Unique ID)';
                if (input) input.placeholder = 'user_123';
            } else {
                if (label) label.innerText = 'Identity Value (Phone)';
                if (input) input.placeholder = '+1234567890';
            }
            saveConfig();
        });
    }
}

async function generateToken() {
    let domain = document.getElementById('domain')?.value || '';
    const orgId = document.getElementById('orgId')?.value || '';
    const clientId = document.getElementById('clientId')?.value || '';
    const clientSecret = document.getElementById('clientSecret')?.value || '';
    const identityType = document.getElementById('identityType')?.value || 'email';
    const identityValue = document.getElementById('identityValue')?.value || '';

    // Clean domain - remove any http:// or https://
    domain = domain.replace(/^https?:\/\//, '');
    
    if (!domain || !orgId || !clientId || !clientSecret || !identityValue) {
        addLog('❌ Please fill all credential fields', 'error');
        return;
    }

    addLog(`🔐 Generating token...`, 'info');

    const payload = {
        client_id: clientId,
        client_secret: clientSecret,
        org_id: orgId,
        [identityType]: identityValue
    };

    try {
        const url = `https://${domain}/v1/core/oauth/token`;
        addLog(`📡 URL: ${url}`, 'info');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.access_token) {
            accessToken = data.access_token;
            tokenExpiry = new Date(Date.now() + (data.expires_in || 43200) * 1000);
            localStorage.setItem('moxo_binder_token', JSON.stringify({
                access_token: accessToken,
                expiry: tokenExpiry.toISOString()
            }));
            const tokenDot = document.getElementById('tokenDot');
            const tokenStatus = document.getElementById('tokenStatus');
            if (tokenDot) tokenDot.classList.add('valid');
            if (tokenStatus) tokenStatus.innerText = 'Token Ready';
            addLog('✅ Token generated successfully!', 'success');
            saveConfig();
        } else {
            addLog(`❌ Token failed: ${data.message || data.error || 'Unknown error'}`, 'error');
        }
    } catch (err) {
        addLog(`❌ Error: ${err.message}`, 'error');
    }
}

async function createGroupBinder(client, internalTeam, boardOwnerEmail, settings) {
    if (!accessToken) return { success: false, error: 'No token' };
    
    const users = [];
    let hasOwner = false;
    
    // Add all internal team members (these must EXIST in Moxo)
    for (const member of internalTeam) {
        if (!member.email || !member.email.trim()) continue;
        
        const userObj = { 
            user: { 
                email: member.email.trim()
            } 
        };
        
        // If this member is the specified BOARD_OWNER
        if (boardOwnerEmail && member.email.trim() === boardOwnerEmail.trim()) {
            userObj.user.member_type = 'BOARD_OWNER';
            hasOwner = true;
        }
        users.push(userObj);
    }
    
    // Add client as member (client must EXIST in Moxo)
    const clientUserObj = { 
        user: { 
            email: client.email.trim()
        } 
    };
    users.push(clientUserObj);
    
    // If still no owner found, add first internal user as BOARD_OWNER
    if (!hasOwner && users.length > 0) {
        users[0].user.member_type = 'BOARD_OWNER';
        addLog(`⚠️ No BOARD_OWNER specified, assigning ${users[0].user.email} as owner`, 'warning');
        hasOwner = true;
    }
    
    // Build binder name with variables
    let binderName = settings.binderNameTemplate
        .replace(/{{name}}/g, client.name)
        .replace(/{{email}}/g, client.email);
    
    // Build reference ID if provided
    let referenceId = null;
    if (settings.referenceId && settings.referenceId.trim()) {
        referenceId = settings.referenceId
            .replace(/{{name}}/g, client.name)
            .replace(/{{email}}/g, client.email);
    }
    
    // Build payload
    const payload = { 
        name: binderName,
        users: users
    };
    
    if (settings.description && settings.description.trim()) {
        payload.description = settings.description;
    }
    if (referenceId) {
        payload.reference_id = referenceId;
    }
    if (settings.restricted) {
        payload.restricted = true;
    }
    if (settings.suppressFeed) {
        payload.suppress_feed = true;
    }
    
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));
    
    try {
        const url = `https://${settings.domain}/v1/${settings.orgId}/binders`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        console.log('📨 Response:', data);
        
        if (data.code === 'RESPONSE_SUCCESS') {
            return { success: true, binderId: data.data?.id, name: binderName };
        } else {
            return { success: false, error: data.message || data.code };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function createGroupBinders() {
    if (!accessToken) {
        addLog('❌ Generate token first', 'error');
        return;
    }
    
    let domain = document.getElementById('domain')?.value || '';
    const orgId = document.getElementById('orgId')?.value || '';
    
    domain = domain.replace(/^https?:\/\//, '');
    
    if (!domain || !orgId) {
        addLog('❌ Please configure domain and org ID', 'error');
        return;
    }
    
    // Parse clients (format: email,name)
    const clientsTextarea = document.getElementById('clientsList');
    if (!clientsTextarea) {
        addLog('❌ Clients list not found', 'error');
        return;
    }
    
    const clientsText = clientsTextarea.value;
    const clients = [];
    for (const line of clientsText.split('\n')) {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.includes(',')) {
            const parts = trimmedLine.split(',');
            const email = parts[0].trim();
            const name = parts[1] ? parts[1].trim() : email.split('@')[0];
            if (email && email.includes('@')) {
                clients.push({ email, name });
            }
        }
    }
    
    // Parse internal team (format: email)
    const teamTextarea = document.getElementById('teamList');
    const internalTeam = [];
    if (teamTextarea) {
        for (const line of teamTextarea.value.split('\n')) {
            const trimmedLine = line.trim();
            if (trimmedLine && trimmedLine.includes(',')) {
                const parts = trimmedLine.split(',');
                const email = parts[0].trim();
                if (email && email.includes('@')) {
                    internalTeam.push({ email, member_type: '' });
                }
            }
        }
    }
    
    // Get BOARD_OWNER email from input
    const boardOwnerEmailInput = document.getElementById('boardOwnerEmail');
    const boardOwnerEmail = boardOwnerEmailInput ? boardOwnerEmailInput.value.trim() : '';
    
    if (clients.length === 0) {
        addLog('❌ Add at least one client (format: email,name)', 'error');
        return;
    }
    
    if (internalTeam.length === 0) {
        addLog('❌ Add at least one internal team member (format: email)', 'error');
        return;
    }
    
    // IMPORTANT: Warn that all users must exist in Moxo
    addLog('⚠️ IMPORTANT: All client emails and internal team emails MUST already exist in your Moxo organization!', 'warning');
    
    if (!boardOwnerEmail) {
        addLog('⚠️ No BOARD_OWNER specified, will auto-assign first internal user', 'warning');
    } else if (!internalTeam.some(m => m.email === boardOwnerEmail)) {
        addLog(`⚠️ BOARD_OWNER ${boardOwnerEmail} not in team list, adding as member`, 'warning');
        internalTeam.push({ email: boardOwnerEmail, member_type: '' });
    }
    
    const settings = {
        domain: domain,
        orgId: orgId,
        binderNameTemplate: document.getElementById('binderNameTemplate')?.value || '{{name}} Workspace',
        description: document.getElementById('binderDescription')?.value || '',
        referenceId: document.getElementById('referenceId')?.value || '',
        restricted: document.getElementById('restricted')?.checked || false,
        suppressFeed: document.getElementById('suppressFeed')?.checked || false
    };
    
    const total = clients.length;
    addLog(`🚀 Creating ${total} group binders...`, 'info');
    addLog(`👥 Each binder will have ${internalTeam.length} internal members + 1 client`, 'info');
    addLog(`📋 Internal team: ${internalTeam.map(m => m.email).join(', ')}`, 'info');
    if (boardOwnerEmail) {
        addLog(`👑 BOARD_OWNER: ${boardOwnerEmail}`, 'info');
    }
    
    // Show progress UI
    const createBtn = document.getElementById('createBtn');
    const statusBadge = document.getElementById('statusBadge');
    const progressSection = document.getElementById('progressSection');
    
    if (createBtn) {
        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Creating...';
    }
    if (statusBadge) {
        statusBadge.classList.add('running');
        statusBadge.innerText = 'Creating...';
    }
    if (progressSection) progressSection.style.display = 'block';
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < total; i++) {
        const client = clients[i];
        addLog(`[${i+1}/${total}] Creating binder for ${client.name} (${client.email})...`, 'info');
        
        const result = await createGroupBinder(client, internalTeam, boardOwnerEmail, settings);
        
        if (result.success) {
            successCount++;
            addLog(`✅ [${i+1}/${total}] Created: ${result.name} (ID: ${result.binderId})`, 'success');
        } else {
            errorCount++;
            addLog(`❌ [${i+1}/${total}] Failed: ${client.email} - ${result.error}`, 'error');
        }
        
        // Update progress
        const percent = ((i + 1) / total) * 100;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const successCountSpan = document.getElementById('successCount');
        const errorCountSpan = document.getElementById('errorCount');
        
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.innerText = `${i+1}/${total} processed`;
        if (successCountSpan) successCountSpan.innerText = successCount;
        if (errorCountSpan) errorCountSpan.innerText = errorCount;
    }
    
    // Reset UI
    if (createBtn) {
        createBtn.disabled = false;
        createBtn.innerHTML = '<i class="fas fa-play"></i> Create Group Binders';
    }
    if (statusBadge) {
        statusBadge.classList.remove('running');
        statusBadge.innerText = 'Ready';
    }
    
    addLog(`🎉 Complete! Success: ${successCount}, Failed: ${errorCount}`, successCount > 0 ? 'success' : 'info');
}

function clearLogs() {
    const logContainer = document.getElementById('logContainer');
    if (logContainer) {
        logContainer.innerHTML = `<div class="log-entry info"><i class="fas fa-check-circle"></i> Logs cleared</div>`;
    }
}

function toggleConfig() {
    const panel = document.getElementById('configPanel');
    if (panel) panel.classList.toggle('show');
}

function uploadCSV(type) {
    const input = document.getElementById(`${type}Csv`);
    if (input) input.click();
}

function handleCSVUpload(type, input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const lines = content.split('\n');
        const rows = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                rows.push(lines[i].trim());
            }
        }
        
        const textarea = document.getElementById(`${type}List`);
        if (textarea) {
            const existing = textarea.value.split('\n').filter(l => l.trim());
            const all = [...existing, ...rows];
            textarea.value = all.join('\n');
        }
        updateCounts();
        addLog(`📄 ${rows.length} ${type} loaded from CSV`, 'success');
    };
    reader.readAsText(file);
    input.value = '';
}

function downloadSampleCSV(type) {
    let content = '';
    if (type === 'clients') {
        content = 'email,name\nclient1@example.com,John Client\nclient2@example.com,Sarah Client\nclient3@example.com,Mike Client';
    } else {
        content = 'email\nkaran.oza@moxo.com\ninternaluser1@company.com\ninternaluser2@company.com';
    }
    
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearClients() {
    const clientsList = document.getElementById('clientsList');
    if (clientsList) clientsList.value = '';
    updateCounts();
}

function clearTeam() {
    const teamList = document.getElementById('teamList');
    if (teamList) teamList.value = '';
    updateCounts();
}

document.addEventListener('DOMContentLoaded', () => {
    loadSavedData();
    addLog('✅ Ready! Configure API and generate token to start', 'success');
});

window.generateToken = generateToken;
window.createGroupBinders = createGroupBinders;
window.clearLogs = clearLogs;
window.toggleConfig = toggleConfig;
window.uploadCSV = uploadCSV;
window.handleCSVUpload = handleCSVUpload;
window.downloadSampleCSV = downloadSampleCSV;
window.clearClients = clearClients;
window.clearTeam = clearTeam;