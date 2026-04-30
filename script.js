// State
let accessToken = null;
let tokenExpiry = null;
let isRunning = false;

function addLog(message, type = 'info') {
    const logContainer = document.getElementById('logContainer');
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    div.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    logContainer.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updatePreview() {
    const template = document.getElementById('binderNameTemplate').value;
    const clientsText = document.getElementById('clientsList').value;
    const firstLine = clientsText.split('\n').find(l => l.trim() && l.includes(','));
    
    if (firstLine) {
        const parts = firstLine.split(',');
        const name = parts[1] ? parts[1].trim() : parts[0].split('@')[0];
        const email = parts[0].trim();
        let preview = template.replace(/{{name}}/g, name).replace(/{{email}}/g, email);
        document.getElementById('namePreviewText').innerText = preview;
    } else {
        document.getElementById('namePreviewText').innerText = 'Add client to see preview';
    }
}

function updateCounts() {
    const clients = document.getElementById('clientsList').value.split('\n').filter(l => l.trim() && l.includes(','));
    const team = document.getElementById('teamList').value.split('\n').filter(l => l.trim() && l.includes(','));
    document.getElementById('clientCount').innerText = `${clients.length} clients`;
    document.getElementById('teamCount').innerText = `${team.length} members`;
    updatePreview();
}

function saveConfig() {
    const config = {
        domain: document.getElementById('domain').value,
        orgId: document.getElementById('orgId').value,
        clientId: document.getElementById('clientId').value,
        clientSecret: document.getElementById('clientSecret').value,
        identityType: document.getElementById('identityType').value,
        identityValue: document.getElementById('identityValue').value,
        binderNameTemplate: document.getElementById('binderNameTemplate').value,
        binderDescription: document.getElementById('binderDescription').value,
        referenceId: document.getElementById('referenceId').value,
        workspaceTags: document.getElementById('workspaceTags').value,
        boardOwnerEmail: document.getElementById('boardOwnerEmail').value,
        restricted: document.getElementById('restricted').checked,
        suppressFeed: document.getElementById('suppressFeed').checked
    };
    localStorage.setItem('moxo_binder_config', JSON.stringify(config));
}

function loadSavedData() {
    const saved = localStorage.getItem('moxo_binder_config');
    if (saved) {
        try {
            const c = JSON.parse(saved);
            document.getElementById('domain').value = c.domain || '';
            document.getElementById('orgId').value = c.orgId || '';
            document.getElementById('clientId').value = c.clientId || '';
            document.getElementById('clientSecret').value = c.clientSecret || '';
            document.getElementById('identityType').value = c.identityType || 'email';
            document.getElementById('identityValue').value = c.identityValue || '';
            document.getElementById('binderNameTemplate').value = c.binderNameTemplate || '{{name}} Workspace';
            document.getElementById('binderDescription').value = c.binderDescription || '';
            document.getElementById('referenceId').value = c.referenceId || '';
            document.getElementById('workspaceTags').value = c.workspaceTags || '';
            document.getElementById('boardOwnerEmail').value = c.boardOwnerEmail || '';
            document.getElementById('restricted').checked = c.restricted || false;
            document.getElementById('suppressFeed').checked = c.suppressFeed || false;
        } catch(e) {}
    }
    
    const savedToken = localStorage.getItem('moxo_binder_token');
    if (savedToken) {
        try {
            const t = JSON.parse(savedToken);
            if (new Date(t.expiry) > new Date()) {
                accessToken = t.access_token;
                tokenExpiry = t.expiry;
                document.getElementById('tokenDot').classList.add('valid');
                document.getElementById('tokenStatus').innerText = 'Token Ready';
            }
        } catch(e) {}
    }
    
    updateCounts();
    attachListeners();
}

function attachListeners() {
    document.getElementById('clientsList').addEventListener('input', updateCounts);
    document.getElementById('teamList').addEventListener('input', updateCounts);
    document.getElementById('binderNameTemplate').addEventListener('input', () => {
        updatePreview();
        saveConfig();
    });
    
    ['domain', 'orgId', 'clientId', 'clientSecret', 'identityType', 'identityValue', 
     'binderDescription', 'referenceId', 'workspaceTags', 'boardOwnerEmail'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', saveConfig);
    });
    
    document.getElementById('restricted').addEventListener('change', saveConfig);
    document.getElementById('suppressFeed').addEventListener('change', saveConfig);
    
    document.getElementById('identityType').addEventListener('change', function() {
        const type = this.value;
        const label = document.getElementById('identityLabel');
        const input = document.getElementById('identityValue');
        if (type === 'email') {
            label.innerText = 'Identity Value (Email)';
            input.placeholder = 'admin@example.com';
        } else if (type === 'unique_id') {
            label.innerText = 'Identity Value (Unique ID)';
            input.placeholder = 'user_123';
        } else {
            label.innerText = 'Identity Value (Phone)';
            input.placeholder = '+1234567890';
        }
        saveConfig();
    });
}

async function generateToken() {
    const domain = document.getElementById('domain').value;
    const orgId = document.getElementById('orgId').value;
    const clientId = document.getElementById('clientId').value;
    const clientSecret = document.getElementById('clientSecret').value;
    const identityType = document.getElementById('identityType').value;
    const identityValue = document.getElementById('identityValue').value;

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
        const response = await fetch(`https://${domain}/v1/core/oauth/token`, {
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
            document.getElementById('tokenDot').classList.add('valid');
            document.getElementById('tokenStatus').innerText = 'Token Ready';
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
    
    // Add all internal team members
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
    
    // Add client as member
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
    
    // Build workspace tags - FIXED: better JSON parsing
    let workspaceTags = null;
    if (settings.workspaceTags && settings.workspaceTags.trim()) {
        try {
            // Try to parse as JSON
            const tagsObj = JSON.parse(settings.workspaceTags);
            workspaceTags = Object.entries(tagsObj).map(([name, value]) => ({ name, value }));
        } catch(e) {
            addLog(`⚠️ Invalid JSON for workspace tags, skipping: ${e.message}`, 'warning');
            // Don't fail the whole request, just skip tags
        }
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
    if (workspaceTags && workspaceTags.length > 0) {
        payload.workspace_tags = workspaceTags;
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
    
    const domain = document.getElementById('domain').value;
    const orgId = document.getElementById('orgId').value;
    
    if (!domain || !orgId) {
        addLog('❌ Please configure domain and org ID', 'error');
        return;
    }
    
    // Parse clients (format: email,name)
    const clientsText = document.getElementById('clientsList').value;
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
    const teamText = document.getElementById('teamList').value;
    const internalTeam = [];
    for (const line of teamText.split('\n')) {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.includes(',')) {
            const parts = trimmedLine.split(',');
            const email = parts[0].trim();
            if (email && email.includes('@')) {
                internalTeam.push({ email, member_type: '' });
            }
        }
    }
    
    // Get BOARD_OWNER email from input
    const boardOwnerEmail = document.getElementById('boardOwnerEmail').value.trim();
    
    if (clients.length === 0) {
        addLog('❌ Add at least one client (format: email,name)', 'error');
        return;
    }
    
    if (internalTeam.length === 0) {
        addLog('❌ Add at least one internal team member (format: email)', 'error');
        return;
    }
    
    if (!boardOwnerEmail) {
        addLog('⚠️ No BOARD_OWNER specified, will auto-assign first internal user', 'warning');
    } else if (!internalTeam.some(m => m.email === boardOwnerEmail)) {
        addLog(`⚠️ BOARD_OWNER ${boardOwnerEmail} not in team list, adding as member`, 'warning');
        internalTeam.push({ email: boardOwnerEmail, member_type: '' });
    }
    
    const settings = {
        domain: domain,
        orgId: orgId,
        binderNameTemplate: document.getElementById('binderNameTemplate').value,
        description: document.getElementById('binderDescription').value,
        referenceId: document.getElementById('referenceId').value,
        workspaceTags: document.getElementById('workspaceTags').value,
        restricted: document.getElementById('restricted').checked,
        suppressFeed: document.getElementById('suppressFeed').checked
    };
    
    const total = clients.length;
    addLog(`🚀 Creating ${total} group binders...`, 'info');
    addLog(`👥 Each binder will have ${internalTeam.length} internal members + 1 client`, 'info');
    addLog(`📋 Internal team: ${internalTeam.map(m => m.email).join(', ')}`, 'info');
    if (boardOwnerEmail) {
        addLog(`👑 BOARD_OWNER: ${boardOwnerEmail}`, 'info');
    }
    
    // Show progress UI
    document.getElementById('createBtn').disabled = true;
    document.getElementById('createBtn').innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Creating...';
    document.getElementById('statusBadge').classList.add('running');
    document.getElementById('statusBadge').innerText = 'Creating...';
    document.getElementById('progressSection').style.display = 'block';
    
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
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressText').innerText = `${i+1}/${total} processed`;
        document.getElementById('successCount').innerText = successCount;
        document.getElementById('errorCount').innerText = errorCount;
    }
    
    // Reset UI
    document.getElementById('createBtn').disabled = false;
    document.getElementById('createBtn').innerHTML = '<i class="fas fa-play"></i> Create Group Binders';
    document.getElementById('statusBadge').classList.remove('running');
    document.getElementById('statusBadge').innerText = 'Ready';
    
    addLog(`🎉 Complete! Success: ${successCount}, Failed: ${errorCount}`, successCount > 0 ? 'success' : 'info');
}

function clearLogs() {
    const logContainer = document.getElementById('logContainer');
    logContainer.innerHTML = `<div class="log-entry info"><i class="fas fa-check-circle"></i> Logs cleared</div>`;
}

function toggleConfig() {
    document.getElementById('configPanel').classList.toggle('show');
}

function uploadCSV(type) {
    document.getElementById(`${type}Csv`).click();
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
        const existing = textarea.value.split('\n').filter(l => l.trim());
        const all = [...existing, ...rows];
        textarea.value = all.join('\n');
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
    document.getElementById('clientsList').value = '';
    updateCounts();
}

function clearTeam() {
    document.getElementById('teamList').value = '';
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