// Call Detail Journey Visualization
const API_BASE = window.location.origin;
let callId = null;
let currentCallData = null;
let stagesData = [];

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

// API Helper
async function apiRequest(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
        throw new Error('API request failed');
    }
    return response.json();
}

// Get Call ID from URL
function getCallIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Format Duration - FIX IST OFFSET
function formatDuration(start, end) {
    if (!start || !end) return 'N/A';

    let startDate, endDate;

    // Handle different timestamp formats
    if (typeof start === 'string') {
        if (start.includes(' ') && !start.includes('T') && !start.includes('Z')) {
            startDate = new Date(start.replace(' ', 'T') + 'Z');
        } else if (start.includes('T') && !start.includes('Z')) {
            startDate = new Date(start + 'Z');
        } else {
            startDate = new Date(start);
        }
    } else {
        startDate = new Date(start);
    }

    if (typeof end === 'string') {
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

    const ms = endDate.getTime() - startDate.getTime();

    if (ms < 0 || isNaN(ms)) return 'N/A';

    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${totalSeconds}s`;
}

// Format Timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp + 'Z'); // Force UTC
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Build Timeline from Call Data
async function buildTimeline(callData, messages, tools) {
    const stages = [];

    // Stage 1: Call Created
    stages.push({
        id: 'created',
        name: 'Created',
        description: 'Session initialized',
        time: callData.created_at,
        icon: '1',
        type: 'system'
    });

    // Stage 2: Call Joined
    if (callData.joined_at) {
        stages.push({
            id: 'joined',
            name: 'Joined',
            description: 'User connected',
            time: callData.joined_at,
            icon: '2',
            type: 'user'
        });
    }

    // Stage 3-N: Messages by stage
    const messagesByStage = {};
    if (messages && messages.length > 0) {
        messages.forEach(msg => {
            const stageId = msg.callStageId || 'default';
            if (!messagesByStage[stageId]) {
                messagesByStage[stageId] = [];
            }
            messagesByStage[stageId].push(msg);
        });

        Object.keys(messagesByStage).forEach((stageId, index) => {
            const stageMsgs = messagesByStage[stageId];

            stages.push({
                id: stageId,
                name: `Stage ${index + 1}`,
                description: `${stageMsgs.length} messages`,
                time: stageMsgs[0].timespan?.start || stageMsgs[0].created_at,
                icon: String(stages.length + 1),
                type: 'agent',
                messages: stageMsgs,
                messageCount: stageMsgs.length
            });
        });
    }

    // Add Tool Invocations
    if (tools && tools.length > 0) {
        tools.forEach((tool, index) => {
            stages.push({
                id: `tool-${index}`,
                name: tool.tool_name,
                description: 'Tool invoked',
                time: tool.created_at,
                icon: 'T',
                type: 'tool',
                toolData: tool
            });
        });
    }

    // Stage N: Call Ended
    if (callData.ended_at) {
        stages.push({
            id: 'ended',
            name: 'Ended',
            description: callData.end_reason || 'Completed',
            time: callData.ended_at,
            icon: '✓',
            type: 'system'
        });
    }

    // Sort by time
    stages.sort((a, b) => {
        const aTime = Date.parse(a.time + 'Z');
        const bTime = Date.parse(b.time + 'Z');
        return aTime - bTime;
    });

    return stages;
}

// Render Flow Diagram with SVG Arrows
function renderFlowDiagram(stages) {
    const nodesHtml = stages.map((stage, index) => `
        <div class="flow-node" data-node-index="${index}" onclick="openStageModal('${stage.id}')">
            <div class="node-circle type-${stage.type}">
                ${stage.icon}
            </div>
            <div class="node-content">
                <div class="node-title">${stage.name}</div>
                <div class="node-subtitle">${stage.description}</div>
                <div class="node-time">${formatTimestamp(stage.time)}</div>
                ${stage.messageCount ? `<div class="node-badge">${stage.messageCount} msgs</div>` : ''}
            </div>
        </div>
    `).join('');

    // Generate SVG arrows
    const arrowsHtml = stages.length > 1 ? `
        <svg class="flow-arrows" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="var(--color-border)" />
                </marker>
            </defs>
            ${stages.slice(0, -1).map((_, idx) => `
                <line class="arrow-line"
                      x1="${150 + (idx * 250)}"
                      y1="150"
                      x2="${250 + (idx * 250)}"
                      y2="150"
                      style="animation-delay: ${idx * 0.2 + 0.5}s;" />
            `).join('')}
        </svg>
    ` : '';

    return `
        <div class="flow-header">Call Flow Journey</div>
        <div class="flow-subtitle">Click on any node to view details</div>
        <div class="flow-diagram">
            ${arrowsHtml}
            <div class="flow-track">
                ${nodesHtml}
            </div>
        </div>
    `;
}

// Open Stage Modal
function openStageModal(stageId) {
    const stage = stagesData.find(s => s.id === stageId);
    if (!stage) return;

    const modal = document.getElementById('stageModal');
    const titleEl = document.getElementById('stageModalTitle');
    const messagesEl = document.getElementById('stageModalMessages');
    const recordingEl = document.getElementById('stageModalRecording');

    // Set title
    titleEl.textContent = `${stage.name} - ${stage.description}`;

    // ALWAYS show recording at top if available (for entire call, not just stage)
    if (currentCallData && currentCallData.recording_enabled && currentCallData.ended_at) {
        recordingEl.style.display = 'block';
        recordingEl.className = 'stage-modal-recording';
        recordingEl.innerHTML = `
            <div class="stage-modal-recording-label">Call Recording</div>
            <audio controls style="width: 100%;">
                <source src="/api/calls/${callId}/recording" type="audio/wav">
                Your browser does not support audio playback.
            </audio>
        `;
    } else {
        recordingEl.style.display = 'none';
    }

    // Build messages
    let messagesHtml = '';

    if (stage.messages && stage.messages.length > 0) {
        messagesHtml = stage.messages.map((msg, index) => {
            // Detect role from Ultravox API format
            let role = 'agent'; // default

            // Check role field (Ultravox uses MESSAGE_ROLE_* enum)
            if (msg.role) {
                const roleStr = msg.role.toUpperCase();
                if (roleStr.includes('USER') || roleStr.includes('HUMAN')) {
                    role = 'user';
                } else if (roleStr.includes('AGENT') || roleStr.includes('ASSISTANT')) {
                    role = 'agent';
                } else if (roleStr.includes('TOOL')) {
                    role = 'tool';
                } else if (roleStr === 'MESSAGE_ROLE_UNSPECIFIED') {
                    // Alternate between agent and user
                    // Typically: agent greets first (index 0), user responds (index 1), etc.
                    role = (index % 2 === 0) ? 'agent' : 'user';
                }
            } else {
                // No role field - use alternating pattern
                role = (index % 2 === 0) ? 'agent' : 'user';
            }

            // Override if it's clearly a tool message
            if (msg.toolName && msg.toolName !== '' && msg.toolName !== null) {
                role = 'tool';
            }

            const avatarText = role === 'user' ? 'U' : role === 'agent' ? 'AI' : 'T';
            const messageText = escapeHtml(msg.text || msg.content || 'No text');

            return `
                <div class="chat-message ${role}">
                    <div class="chat-avatar">${avatarText}</div>
                    <div class="chat-bubble">
                        <div class="message-content">${messageText}</div>
                    </div>
                </div>
            `;
        }).join('');
    } else if (stage.toolData) {
        let params = {};
        try {
            params = JSON.parse(stage.toolData.parameters || '{}');
        } catch (e) {
            params = stage.toolData.parameters || {};
        }

        messagesHtml = `
            <div class="tool-call-container">
                <div class="tool-call-header">
                    <div class="tool-icon">T</div>
                    <div class="tool-name">${escapeHtml(stage.toolData.tool_name)}</div>
                </div>
                <div class="tool-call-body">
                    <div class="json-label">Parameters</div>
                    <pre class="json-display">${JSON.stringify(params, null, 2)}</pre>
                </div>
            </div>
        `;
    } else {
        messagesHtml = `
            <div style="text-align: center; color: var(--color-text-secondary); padding: 2rem;">
                No messages or details available for this stage.
            </div>
        `;
    }

    messagesEl.innerHTML = messagesHtml;
    modal.classList.add('active');
}

// Close Stage Modal
function closeStageModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('stageModal');
    modal.classList.remove('active');
    // Pause any playing audio
    const audio = modal.querySelector('audio');
    if (audio) audio.pause();
}

// Recording Modal
function openRecordingModal(callId) {
    const modal = document.getElementById('recordingModal');
    const audio = document.getElementById('recordingAudio');
    const source = document.getElementById('recordingSource');
    source.src = `/api/calls/${callId}/recording`;
    audio.load();
    modal.classList.add('active');
}

function closeRecordingModal() {
    const modal = document.getElementById('recordingModal');
    const audio = document.getElementById('recordingAudio');
    audio.pause();
    modal.classList.remove('active');
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render Full Journey
async function renderCallJourney(callId) {
    try {
        // Fetch call details
        const callDetails = await apiRequest(`/api/calls/${callId}`);
        const call = callDetails.call;

        // Store globally for modal access
        currentCallData = call;

        // Fetch messages
        let messages = [];
        try {
            const msgResponse = await apiRequest(`/api/calls/${callId}/messages`);
            messages = msgResponse.messages || [];
        } catch (e) {
            console.log('No messages available');
        }

        const tools = callDetails.tool_invocations || [];

        // Build timeline
        const stages = await buildTimeline(call, messages, tools);

        // Store globally for modal access
        stagesData = stages;

        // Calculate stats
        const duration = formatDuration(call.created_at, call.ended_at);
        const messageCount = messages.length;
        const toolCount = tools.length;

        // Build HTML
        const html = `
            <div class="journey-header">
                <div class="journey-title">
                    <h1>Call Journey</h1>
                    <div class="journey-meta">
                        <div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            ${formatTimestamp(call.created_at)}
                        </div>
                        <div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                            ${escapeHtml(call.call_id.substring(0, 12))}...
                        </div>
                        <div><span class="status-badge ${call.status}">${escapeHtml(call.status.toUpperCase())}</span></div>
                    </div>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${duration}</div>
                    <div class="stat-label">Duration</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${messageCount}</div>
                    <div class="stat-label">Messages</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${toolCount}</div>
                    <div class="stat-label">Tools Used</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stages.length}</div>
                    <div class="stat-label">Stages</div>
                </div>
            </div>

            ${call.recording_enabled && call.ended_at ? `
                <div class="recording-section">
                    <div class="recording-info">
                        <div class="recording-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
                            </svg>
                        </div>
                        <div class="recording-text">
                            <h3>Call Recording Available</h3>
                            <p>Full audio recording of this conversation</p>
                        </div>
                    </div>
                    <button class="recording-btn" onclick="openRecordingModal('${callId}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                        </svg>
                        Play Recording
                    </button>
                </div>
            ` : ''}

            ${call.short_summary ? `
                <div class="summary-section">
                    <h2>Call Summary</h2>
                    <div class="summary-text">${escapeHtml(call.short_summary)}</div>
                </div>
            ` : ''}

            <div class="flow-section">
                ${renderFlowDiagram(stages)}
            </div>
        `;

        document.getElementById('journeyContent').innerHTML = html;
        document.getElementById('journeyContent').style.display = 'block';
        document.getElementById('loadingSpinner').style.display = 'none';

    } catch (error) {
        console.error('Error loading call journey:', error);
        document.getElementById('loadingSpinner').innerHTML = `
            <div style="text-align: center; color: var(--color-text-secondary);">
                <div style="font-size: 2rem; margin-bottom: 1rem;">⚠</div>
                <div style="font-weight: 600; margin-bottom: 1rem;">Failed to load call journey</div>
                <button class="btn btn-primary" onclick="location.href='/'"
                    style="padding: 0.75rem 2rem; background: var(--color-primary); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600;">
                    Back to Dashboard
                </button>
            </div>
        `;
    }
}

// Initialize
window.addEventListener('load', () => {
    callId = getCallIdFromUrl();

    if (!callId) {
        showToast('No call ID provided', 'error');
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }

    renderCallJourney(callId);
});

// Make functions globally available
window.openStageModal = openStageModal;
window.closeStageModal = closeStageModal;
window.openRecordingModal = openRecordingModal;
window.closeRecordingModal = closeRecordingModal;
