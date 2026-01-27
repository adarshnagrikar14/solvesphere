// SolveSphere AI Dashboard - Modular Design
const API_BASE = window.location.origin;

// Theme Management
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
});

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// API Request Helper
async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Request failed');
    }
    return response.json();
}

// Load Dashboard Data
async function loadDashboard() {
    try {
        const calls = await apiRequest('/api/calls');
        updateStats(calls.calls);
        updateCallHistory(calls.calls);
        await loadEscalationsAndEngagement(calls.calls);
        await loadWebhooks();
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('Failed to load dashboard', 'error');
    }
}

// Update Stats
function updateStats(calls) {
    const total = calls.length;
    const active = calls.filter(c => c.status === 'joined' || c.status === 'started').length;

    document.getElementById('totalCalls').textContent = total;
    document.getElementById('activeCalls').textContent = active;

    // Count escalations and resolutions
    let escalations = 0;
    let resolved = 0;
    let totalLogged = 0;

    calls.forEach(async (call) => {
        try {
            const details = await apiRequest(`/api/calls/${call.call_id}`);
            if (details.tool_invocations) {
                const hasEscalation = details.tool_invocations.some(t => t.tool_name === 'escalate_to_human');
                if (hasEscalation) escalations++;

                const engagement = details.tool_invocations.find(t => t.tool_name === 'log_call_engagement');
                if (engagement) {
                    totalLogged++;
                    const params = JSON.parse(engagement.parameters);
                    if (params.issue_resolved) resolved++;
                }
            }

            document.getElementById('escalationCount').textContent = escalations;
            const rate = totalLogged > 0 ? Math.round((resolved / totalLogged) * 100) : 0;
            document.getElementById('resolutionRate').textContent = `${rate}%`;
        } catch (error) {
            console.error(`Error loading call ${call.call_id}:`, error);
        }
    });
}

// Update Call History
function updateCallHistory(calls) {
    const container = document.getElementById('callHistoryContainer');
    document.getElementById('callCount').textContent = calls.length;

    if (calls.length === 0) {
        container.innerHTML = '<div class="empty-state">No calls yet</div>';
        return;
    }

    container.innerHTML = calls.slice(0, 10).map(call => {
        const created = new Date(call.created_at).toLocaleString();
        // Calculate duration properly - use ended_at if call ended, otherwise show ongoing
        let duration = 'Ongoing';
        if (call.ended_at) {
            duration = calculateDuration(call.created_at, call.ended_at);
        } else if (call.joined_at) {
            // For ongoing calls, calculate from start to now
            const now = new Date().toISOString();
            duration = calculateDuration(call.created_at, now) + ' (ongoing)';
        }

        return `
            <div class="call-item clickable" data-call-id="${call.call_id}">
                <div class="item-header">
                    <div>
                        <div class="item-title mono">Customer ID: ${call.call_id}</div>
                        <div class="item-meta">${created}</div>
                    </div>
                    <span class="status-badge ${call.status}">${call.status}</span>
                </div>
                <div class="item-footer">
                    <span>Duration: ${duration}</span>
                    ${call.end_reason ? `<span>Reason: ${call.end_reason}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers to call items
    container.querySelectorAll('.call-item.clickable').forEach(item => {
        item.addEventListener('click', () => {
            const callId = item.getAttribute('data-call-id');
            showCallDetailsModal(callId);
        });
    });
}

// Load Escalations and Engagement
async function loadEscalationsAndEngagement(calls) {
    const escalations = [];
    const engagements = [];

    for (const call of calls) {
        try {
            const details = await apiRequest(`/api/calls/${call.call_id}`);
            if (details.tool_invocations) {
                // Escalations
                details.tool_invocations
                    .filter(t => t.tool_name === 'escalate_to_human')
                    .forEach(e => escalations.push({
                        ...e,
                        call_id: call.call_id,
                        params: JSON.parse(e.parameters)
                    }));

                // Engagements
                details.tool_invocations
                    .filter(t => t.tool_name === 'log_call_engagement')
                    .forEach(e => engagements.push({
                        ...e,
                        call_id: call.call_id,
                        params: JSON.parse(e.parameters)
                    }));
            }
        } catch (error) {
            console.error(`Error loading tools for ${call.call_id}:`, error);
        }
    }

    updateEscalations(escalations);
    updateEngagement(engagements);
}

// Update Escalations
function updateEscalations(escalations) {
    const container = document.getElementById('escalationsContainer');
    document.getElementById('escalationBadge').textContent = escalations.length;

    if (escalations.length === 0) {
        container.innerHTML = '<div class="empty-state">No escalations</div>';
        return;
    }

    container.innerHTML = escalations.map(esc => `
        <div class="escalation-item">
            <div class="item-header">
                <div>
                    <div class="item-title">${esc.params.escalation_reason}</div>
                    <div class="item-meta mono">${esc.call_id.substring(0, 8)}...</div>
                </div>
                <span class="priority-badge ${esc.params.priority_level}">${esc.params.priority_level}</span>
            </div>
            <div class="item-content">${esc.params.context_summary}</div>
            <div class="item-footer">
                <span>Sentiment: ${esc.params.customer_sentiment}</span>
                <span>${new Date(esc.invoked_at).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
}

// Update Engagement
function updateEngagement(engagements) {
    const container = document.getElementById('engagementContainer');
    document.getElementById('engagementBadge').textContent = engagements.length;

    if (engagements.length === 0) {
        container.innerHTML = '<div class="empty-state">No engagement data</div>';
        return;
    }

    container.innerHTML = engagements.map(eng => `
        <div class="engagement-item">
            <div class="item-header">
                <div>
                    <div class="item-title">${eng.params.call_phase.replace(/_/g, ' ')}</div>
                    <div class="item-meta mono">${eng.call_id.substring(0, 8)}...</div>
                </div>
                <span class="status-badge">${eng.params.issue_resolved ? 'Resolved' : 'Unresolved'}</span>
            </div>
            <div class="item-content">
                Sentiment: ${eng.params.customer_sentiment} |
                Likelihood: ${eng.params.resolution_likelihood}%
                ${eng.params.engagement_notes ? '<br>' + eng.params.engagement_notes : ''}
            </div>
            <div class="item-footer">
                <span>${new Date(eng.invoked_at).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
}

// Load Webhooks
async function loadWebhooks() {
    try {
        // Get all calls and their webhooks
        const calls = await apiRequest('/api/calls');
        const allWebhooks = [];

        for (const call of calls.calls) {
            const details = await apiRequest(`/api/calls/${call.call_id}`);
            if (details.webhooks) {
                details.webhooks.forEach(w => {
                    allWebhooks.push({
                        ...w,
                        call_id: call.call_id
                    });
                });
            }
        }

        // Sort by most recent
        allWebhooks.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));

        updateWebhooks(allWebhooks.slice(0, 20));
    } catch (error) {
        console.error('Error loading webhooks:', error);
    }
}

// Update Webhooks
function updateWebhooks(webhooks) {
    const container = document.getElementById('webhookContainer');
    document.getElementById('webhookBadge').textContent = webhooks.length;

    if (webhooks.length === 0) {
        container.innerHTML = '<div class="empty-state">No webhook events</div>';
        return;
    }

    container.innerHTML = webhooks.map(wh => `
        <div class="webhook-item">
            <div class="item-header">
                <div>
                    <div class="item-title">${wh.event_type}</div>
                    <div class="item-meta mono">${wh.call_id.substring(0, 12)}...</div>
                </div>
                <div class="item-meta">${new Date(wh.received_at).toLocaleString()}</div>
            </div>
        </div>
    `).join('');
}

// Ultravox SDK connection state
let activeUltravoxSession = null;
let currentCallId = null;
let currentJoinUrl = null;

// Start Call Form
document.getElementById('startCallForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('startCallBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const payload = {
            metadata: {
                customer_id: document.getElementById('customerId').value || 'anonymous',
                session_type: document.getElementById('sessionType').value
            },
            recording_enabled: document.getElementById('recordingEnabled').checked
        };

        const result = await apiRequest('/api/calls', 'POST', payload);

        // Open call dialog and connect WebSocket
        openCallDialog(result.call_id, result.join_url);
        
        // Clear form
        document.getElementById('customerId').value = '';
        document.getElementById('startCallForm').reset();
        document.getElementById('callResult').classList.add('hidden');

        showToast('Call created successfully', 'success');
        await loadDashboard();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Start Call';
    }
});

// Copy URL
document.getElementById('copyUrlBtn').addEventListener('click', () => {
    const url = document.getElementById('resultJoinUrl').textContent;
    navigator.clipboard.writeText(url);
    showToast('URL copied', 'success');
});

// SIP Outbound Call
document.getElementById('makeOutboundCallBtn').addEventListener('click', async () => {
    const phoneNumber = document.getElementById('phoneNumber').value.trim();

    if (!phoneNumber) {
        showToast('Please enter a phone number', 'error');
        return;
    }

    const btn = document.getElementById('makeOutboundCallBtn');
    btn.disabled = true;
    btn.textContent = 'Calling...';

    try {
        const payload = {
            to_number: phoneNumber
        };

        const result = await apiRequest('/api/calls/sip/outbound', 'POST', payload);

        // Show result
        document.getElementById('sipResultCallId').textContent = result.call_id;
        document.getElementById('sipResultToNumber').textContent = result.to_number;
        document.getElementById('sipUriContainer').style.display = 'none';
        document.getElementById('toNumberContainer').style.display = 'block';
        document.getElementById('sipCallResult').classList.remove('hidden');

        showToast('Outbound call initiated!', 'success');
        await loadDashboard();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Call User';
    }
});

// SIP Inbound Call
document.getElementById('createInboundCallBtn').addEventListener('click', async () => {
    const btn = document.getElementById('createInboundCallBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const result = await apiRequest('/api/calls/sip/inbound', 'POST', {});

        // Show result
        document.getElementById('sipResultCallId').textContent = result.call_id;
        document.getElementById('sipResultUri').textContent = result.sip_uri || 'N/A';
        document.getElementById('sipUriContainer').style.display = 'block';
        document.getElementById('toNumberContainer').style.display = 'none';
        document.getElementById('sipCallResult').classList.remove('hidden');

        showToast('Inbound call created! Share the SIP URI.', 'success');
        await loadDashboard();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Get Dial-In Number';
    }
});

// Start Chat
document.getElementById('startChatBtn').addEventListener('click', () => {
    window.location.href = '/static/chat.html';
});

// Refresh Button
document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    await loadDashboard();
    showToast('Dashboard refreshed', 'success');
    btn.disabled = false;
});

// Helpers
function calculateDuration(start, end) {
    // Parse dates ensuring UTC handling
    // SQLite stores timestamps as "YYYY-MM-DD HH:MM:SS" (UTC, but no timezone indicator)
    // JavaScript interprets these as LOCAL time, causing 5:30 hour offset in India
    // We need to explicitly parse them as UTC
    
    let startDate, endDate;
    
    if (typeof start === 'string') {
        // SQLite format: "YYYY-MM-DD HH:MM:SS" - convert to ISO and add Z for UTC
        if (start.includes(' ') && !start.includes('T') && !start.includes('Z')) {
            // SQLite format - replace space with T and add Z
            startDate = new Date(start.replace(' ', 'T') + 'Z');
        } else if (start.includes('T') && !start.includes('Z')) {
            // ISO format without Z - add Z for UTC
            startDate = new Date(start + 'Z');
        } else {
            // Already has Z or is Date object
            startDate = new Date(start);
        }
    } else {
        startDate = new Date(start);
    }
    
    if (typeof end === 'string') {
        // Same logic for end date
        if (end.includes(' ') && !end.includes('T') && !end.includes('Z')) {
            endDate = new Date(end.replace(' ', 'T') + 'Z');
        } else if (end.includes('T') && !end.includes('Z')) {
            endDate = new Date(end + 'Z');
        } else {
            endDate = new Date(end);
        }
    } else {
        endDate = new Date(end);
    }
    
    // getTime() returns UTC milliseconds since epoch
    // Now both dates are correctly parsed as UTC, so difference is accurate
    const startUTC = startDate.getTime();
    const endUTC = endDate.getTime();
    
    // Calculate difference in milliseconds
    const diff = endUTC - startUTC;
    
    // Handle negative or invalid durations
    if (diff < 0 || isNaN(diff)) {
        return 'N/A';
    }
    
    const totalSeconds = Math.floor(diff / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);
    
    const seconds = totalSeconds % 60;
    const minutes = totalMinutes % 60;
    const hours = totalHours % 24;
    
    // Format duration
    if (totalDays > 0) {
        return `${totalDays}d ${hours}h ${minutes}m`;
    } else if (totalHours > 0) {
        return `${totalHours}h ${minutes}m`;
    } else if (totalMinutes > 0) {
        return `${totalMinutes}m ${seconds}s`;
    } else {
        return `${totalSeconds}s`;
    }
}

// Show Call Details Modal
async function showCallDetailsModal(callId) {
    const modal = document.getElementById('callDetailsModal');
    const modalBody = document.getElementById('modalBody');
    
    modal.classList.add('active');
    modalBody.innerHTML = '<div class="loading">Loading call details...</div>';

    try {
        const details = await apiRequest(`/api/calls/${callId}`);
        const call = details.call;
        const webhooks = details.webhooks || [];
        const toolInvocations = details.tool_invocations || [];

        // Parse metadata if it's a string
        let metadata = {};
        if (call.metadata) {
            try {
                metadata = typeof call.metadata === 'string' ? JSON.parse(call.metadata) : call.metadata;
            } catch (e) {
                metadata = {};
            }
        }

        // Calculate duration - use ended_at if available, otherwise use joined_at, otherwise show ongoing
        let duration = 'N/A';
        if (call.created_at && call.ended_at) {
            duration = calculateDuration(call.created_at, call.ended_at);
        } else if (call.created_at && call.joined_at) {
            const currentTime = new Date().toISOString();
            duration = calculateDuration(call.created_at, currentTime) + ' (ongoing)';
        } else if (call.created_at) {
            const currentTime = new Date().toISOString();
            duration = calculateDuration(call.created_at, currentTime) + ' (ongoing)';
        }

        modalBody.innerHTML = `
            <div class="metadata-section">
                <h3>📞 Call Overview</h3>
                <div class="info-card">
                    <div class="info-row">
                        <span class="info-label">Customer ID</span>
                        <span class="info-value mono">${call.call_id}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Status</span>
                        <span class="status-badge ${call.status}">${call.status.toUpperCase()}</span>
                    </div>
                    ${call.created_at ? `
                    <div class="info-row">
                        <span class="info-label">Started</span>
                        <span class="info-value">${new Date(call.created_at).toLocaleString()}</span>
                    </div>
                    ` : ''}
                    ${call.joined_at ? `
                    <div class="info-row">
                        <span class="info-label">Connected</span>
                        <span class="info-value">${new Date(call.joined_at).toLocaleString()}</span>
                    </div>
                    ` : ''}
                    ${call.ended_at ? `
                    <div class="info-row">
                        <span class="info-label">Ended</span>
                        <span class="info-value">${new Date(call.ended_at).toLocaleString()}</span>
                    </div>
                    ` : ''}
                    <div class="info-row">
                        <span class="info-label">Duration</span>
                        <span class="info-value">${duration}</span>
                    </div>
                    ${call.end_reason ? `
                    <div class="info-row">
                        <span class="info-label">End Reason</span>
                        <span class="info-value">${call.end_reason}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            ${call.summary || call.short_summary ? `
            <div class="metadata-section">
                <h3>📝 Call Summary</h3>
                <div class="info-card">
                    ${call.short_summary ? `
                    <div class="summary-text">${call.short_summary}</div>
                    ` : ''}
                    ${call.summary ? `
                    <div class="summary-text full">${call.summary}</div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            ${Object.keys(metadata).length > 0 ? `
            <div class="metadata-section">
                <h3>ℹ️ Additional Information</h3>
                <div class="info-card">
                    ${Object.entries(metadata).map(([key, value]) => `
                        <div class="info-row">
                            <span class="info-label">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                            <span class="info-value">${value}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${toolInvocations.length > 0 ? `
            <div class="metadata-section">
                <h3>🔧 Actions Taken (${toolInvocations.length})</h3>
                <div class="action-list">
                    ${toolInvocations.map(tool => {
                        let params = {};
                        try {
                            params = typeof tool.parameters === 'string' ? JSON.parse(tool.parameters) : tool.parameters;
                        } catch (e) {
                            params = {};
                        }
                        
                        if (tool.tool_name === 'escalate_to_human') {
                            return `
                                <div class="action-card escalation">
                                    <div class="action-header">
                                        <span class="action-icon">🚨</span>
                                        <span class="action-title">Escalation Request</span>
                                        <span class="priority-badge ${params.priority_level || 'medium'}">${(params.priority_level || 'medium').toUpperCase()}</span>
                                    </div>
                                    <div class="action-content">
                                        <div class="action-field">
                                            <span class="field-label">Reason:</span>
                                            <span class="field-value">${params.escalation_reason || 'N/A'}</span>
                                        </div>
                                        ${params.context_summary ? `
                                        <div class="action-field">
                                            <span class="field-label">Context:</span>
                                            <span class="field-value">${params.context_summary}</span>
                                        </div>
                                        ` : ''}
                                        ${params.customer_sentiment ? `
                                        <div class="action-field">
                                            <span class="field-label">Customer Sentiment:</span>
                                            <span class="sentiment-badge ${params.customer_sentiment}">${params.customer_sentiment}</span>
                                        </div>
                                        ` : ''}
                                    </div>
                                    <div class="action-footer">
                                        <span>${new Date(tool.invoked_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            `;
                        } else if (tool.tool_name === 'log_call_engagement') {
                            return `
                                <div class="action-card engagement">
                                    <div class="action-header">
                                        <span class="action-icon">📊</span>
                                        <span class="action-title">Engagement Log</span>
                                        <span class="status-badge ${params.issue_resolved ? 'resolved' : 'unresolved'}">${params.issue_resolved ? 'RESOLVED' : 'UNRESOLVED'}</span>
                                    </div>
                                    <div class="action-content">
                                        <div class="action-field">
                                            <span class="field-label">Call Phase:</span>
                                            <span class="field-value">${(params.call_phase || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                        </div>
                                        ${params.customer_sentiment ? `
                                        <div class="action-field">
                                            <span class="field-label">Customer Sentiment:</span>
                                            <span class="sentiment-badge ${params.customer_sentiment}">${params.customer_sentiment}</span>
                                        </div>
                                        ` : ''}
                                        ${params.resolution_likelihood !== undefined ? `
                                        <div class="action-field">
                                            <span class="field-label">Resolution Likelihood:</span>
                                            <span class="field-value">${params.resolution_likelihood}%</span>
                                        </div>
                                        ` : ''}
                                        ${params.engagement_notes ? `
                                        <div class="action-field full-width">
                                            <span class="field-label">Notes:</span>
                                            <span class="field-value">${params.engagement_notes}</span>
                                        </div>
                                        ` : ''}
                                    </div>
                                    <div class="action-footer">
                                        <span>${new Date(tool.invoked_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            `;
                        }
                        return '';
                    }).join('')}
                </div>
            </div>
            ` : ''}

            ${webhooks.length > 0 ? `
            <div class="metadata-section">
                <h3>📡 System Events (${webhooks.length})</h3>
                <div class="event-list">
                    ${webhooks.map(wh => {
                        let payload = {};
                        try {
                            payload = typeof wh.payload === 'string' ? JSON.parse(wh.payload) : wh.payload;
                        } catch (e) {
                            payload = {};
                        }
                        
                        const eventType = wh.event_type || 'unknown';
                        const eventIcon = eventType.includes('started') ? '🟢' : eventType.includes('joined') ? '🔵' : eventType.includes('ended') ? '🔴' : '⚪';
                        
                        return `
                            <div class="event-card">
                                <div class="event-header">
                                    <span class="event-icon">${eventIcon}</span>
                                    <span class="event-title">${eventType.replace('call.', '').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                    <span class="event-time">${new Date(wh.received_at).toLocaleString()}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}
        `;
    } catch (error) {
        modalBody.innerHTML = `<div class="error">Error loading call details: ${error.message}</div>`;
    }
}

// Close Modal
document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('callDetailsModal').classList.remove('active');
});

// Close modal when clicking outside
document.getElementById('callDetailsModal').addEventListener('click', (e) => {
    if (e.target.id === 'callDetailsModal') {
        document.getElementById('callDetailsModal').classList.remove('active');
    }
});

// Call Dialog Functions
async function openCallDialog(callId, joinUrl) {
    currentCallId = callId;
    currentJoinUrl = joinUrl;
    const dialog = document.getElementById('activeCallDialog');
    const title = document.getElementById('callDialogTitle');
    const status = document.getElementById('callDialogStatus');
    const messages = document.getElementById('conversationMessages');
    const orbStatus = document.getElementById('orbStatus');
    const orb = document.getElementById('callOrb');
    
    title.textContent = `Call: ${callId.substring(0, 12)}...`;
    status.textContent = 'Connecting...';
    orbStatus.textContent = 'Connecting...';
    orb.classList.remove('active');
    messages.innerHTML = '<div class="message system">Connecting to call...</div>';
    
    dialog.classList.add('active');
    
    // Connect using Ultravox SDK
    await connectUltravoxSDK(joinUrl, callId);
}

function closeCallDialog() {
    const dialog = document.getElementById('activeCallDialog');
    dialog.classList.remove('active');
    
    // Disconnect Ultravox SDK
    teardownUltravoxSDK();
    
    currentCallId = null;
    currentJoinUrl = null;
}

async function connectUltravoxSDK(joinUrl, callId) {
    const status = document.getElementById('callDialogStatus');
    const orbStatus = document.getElementById('orbStatus');
    const orb = document.getElementById('callOrb');
    const messages = document.getElementById('conversationMessages');
    const remoteAudio = document.getElementById('remoteAudio');
    
    try {
        // Load Ultravox SDK
        if (!window.__ultravoxModule) {
            status.textContent = 'Loading Ultravox SDK...';
            window.__ultravoxModule = await import('https://cdn.jsdelivr.net/npm/ultravox-client@latest/+esm');
        }

        const UltravoxSession = window.__ultravoxModule.default || window.__ultravoxModule.UltravoxSession;
        if (!UltravoxSession) {
            throw new Error('UltravoxSession export not found');
        }

        // Create session
        activeUltravoxSession = new UltravoxSession({
            audioElement: remoteAudio,
        });

        // Set up event listeners for transcript and events
        // The SDK may use different event methods - try both
        if (activeUltravoxSession.addEventListener) {
            activeUltravoxSession.addEventListener('transcript', (event) => {
                const data = event.detail || event.data || event;
                const speaker = data.speaker || (data.role === 'user' ? 'user' : 'agent');
                const text = data.transcript || data.text || data.content || '';
                if (text && text.trim()) {
                    addMessage(speaker, text);
                }
            });

            activeUltravoxSession.addEventListener('state', (event) => {
                const data = event.detail || event.data || event;
                if (data.status) {
                    status.textContent = data.status;
                }
            });

            activeUltravoxSession.addEventListener('callEvent', (event) => {
                const data = event.detail || event.data || event;
                if (data.event === 'call.ended' || data.type === 'call.ended') {
                    addMessage('system', 'Call ended.');
                    setTimeout(() => {
                        if (currentCallId === callId) {
                            closeCallDialog();
                            loadDashboard();
                        }
                    }, 2000);
                }
            });
        } else if (activeUltravoxSession.on) {
            // Alternative event listener pattern
            activeUltravoxSession.on('transcript', (data) => {
                const speaker = data.speaker || (data.role === 'user' ? 'user' : 'agent');
                const text = data.transcript || data.text || data.content || '';
                if (text && text.trim()) {
                    addMessage(speaker, text);
                }
            });

            activeUltravoxSession.on('state', (data) => {
                if (data.status) {
                    status.textContent = data.status;
                }
            });

            activeUltravoxSession.on('callEvent', (data) => {
                if (data.event === 'call.ended' || data.type === 'call.ended') {
                    addMessage('system', 'Call ended.');
                    setTimeout(() => {
                        if (currentCallId === callId) {
                            closeCallDialog();
                            loadDashboard();
                        }
                    }, 2000);
                }
            });
        }
        
        // Also try listening to the audio element for connection state
        if (remoteAudio) {
            remoteAudio.addEventListener('play', () => {
                orb.classList.add('active');
                orbStatus.textContent = 'Call Active';
            });
        }

        // Join call
        status.textContent = 'Joining call...';
        await activeUltravoxSession.joinCall(joinUrl);
        
        // Start microphone (try different method names)
        status.textContent = 'Starting microphone...';
        try {
            if (activeUltravoxSession.startLocalMicrophone) {
                await activeUltravoxSession.startLocalMicrophone();
            } else if (activeUltravoxSession.startMicrophone) {
                await activeUltravoxSession.startMicrophone();
            } else if (activeUltravoxSession.enableMicrophone) {
                await activeUltravoxSession.enableMicrophone();
            } else {
                // Microphone might start automatically or method doesn't exist
                console.log('Microphone method not found, may start automatically');
            }
        } catch (micError) {
            console.warn('Microphone start error (may be optional):', micError);
            // Continue anyway - microphone might not be required
        }
        
        // Update UI
        status.textContent = 'Connected';
        orbStatus.textContent = 'Call Active';
        orb.classList.add('active');
        addMessage('system', 'Connected to call. Conversation started.');
        
    } catch (error) {
        console.error('Error connecting Ultravox SDK:', error);
        status.textContent = `Connection Failed: ${error.message}`;
        orbStatus.textContent = 'Failed';
        orb.classList.remove('active');
        addMessage('system', `Failed to connect: ${error.message}`);
    }
}

function teardownUltravoxSDK() {
    if (activeUltravoxSession) {
        try {
            if (activeUltravoxSession.leaveCall) {
                activeUltravoxSession.leaveCall();
            }
        } catch (error) {
            console.warn('Error tearing down Ultravox session:', error);
        } finally {
            activeUltravoxSession = null;
        }
    }

    const remoteAudio = document.getElementById('remoteAudio');
    if (remoteAudio) {
        remoteAudio.srcObject = null;
    }
}

function addMessage(speaker, text) {
    const messagesContainer = document.getElementById('conversationMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${speaker}`;
    
    const speakerLabel = speaker === 'agent' ? 'Agent' : speaker === 'user' ? 'You' : 'System';
    messageDiv.innerHTML = `<span class="message-speaker">${speakerLabel}:</span> <span class="message-text">${text}</span>`;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Hangup button
document.getElementById('hangupBtn').addEventListener('click', async () => {
    // Close SDK connection first (this will disconnect the call)
    teardownUltravoxSDK();
    
    // End call via API if we have callId (optional - SDK disconnect might be enough)
    if (currentCallId) {
        try {
            // Try to end call via API (if endpoint exists)
            await apiRequest(`/api/calls/${currentCallId}/end`, 'POST').catch(() => {
                // Endpoint might not exist, that's okay - SDK disconnect is sufficient
                console.log('Call end endpoint not available, SDK disconnect is sufficient');
            });
        } catch (error) {
            // Ignore API errors - SDK disconnect is the main action
            console.log('API end call failed, but SDK disconnect succeeded');
        }
    }
    
    // Close dialog
    closeCallDialog();
    
    // Refresh dashboard
    await loadDashboard();
});

// Close call dialog button
document.getElementById('closeCallDialogBtn').addEventListener('click', () => {
    if (activeWebSocket) {
        activeWebSocket.close();
        activeWebSocket = null;
    }
    closeCallDialog();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    setInterval(loadDashboard, 30000); // Refresh every 30s
});
