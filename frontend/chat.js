// SolveSphere AI Chat Interface
const API_BASE = window.location.origin;
let currentChatId = null;
let ultravoxSession = null;
let isWaitingForResponse = false;
let isInitialized = false;

// Theme Management
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
});

// New Chat
document.getElementById('newChatBtn').addEventListener('click', () => {
    if (currentChatId) {
        if (confirm('Start a new chat? Current conversation will be cleared.')) {
            resetChat();
        }
    }
});

// API Helper
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

// Reset Chat
function resetChat() {
    if (ultravoxSession) {
        try {
            ultravoxSession.leaveCall();
        } catch (e) {
            console.error('Error leaving call:', e);
        }
    }

    currentChatId = null;
    ultravoxSession = null;
    isInitialized = false;
    isWaitingForResponse = false;

    const container = document.getElementById('messagesContainer');
    container.innerHTML = `
        <div class="welcome-screen" id="welcomeScreen">
            <div class="welcome-title">Hello! How can I help you today?</div>
            <div class="welcome-subtitle">Ask me anything or try one of these examples</div>
            <div class="example-prompts">
                <div class="example-prompt" data-prompt="Tell me about your services">
                    <div class="example-prompt-title">Services</div>
                    <div class="example-prompt-text">What can you help me with?</div>
                </div>
                <div class="example-prompt" data-prompt="I need technical support">
                    <div class="example-prompt-title">Support</div>
                    <div class="example-prompt-text">Get technical assistance</div>
                </div>
                <div class="example-prompt" data-prompt="How does this work?">
                    <div class="example-prompt-title">Learn More</div>
                    <div class="example-prompt-text">Understand our platform</div>
                </div>
            </div>
        </div>
    `;

    // Re-attach example prompt handlers
    attachExamplePromptHandlers();

    document.getElementById('sendBtn').disabled = false;
    document.getElementById('messageInput').disabled = false;
}

// Initialize Chat Session
async function initializeChat() {
    if (isInitialized) return;

    try {
        // Create chat session
        const result = await apiRequest('/api/chats', 'POST', {
            metadata: {
                source: 'web_chat',
                timestamp: new Date().toISOString()
            }
        });

        currentChatId = result.chat_id;

        // Load Ultravox SDK
        if (!window.__ultravoxModule) {
            window.__ultravoxModule = await import('https://cdn.jsdelivr.net/npm/ultravox-client@latest/+esm');
        }

        const UltravoxSession = window.__ultravoxModule.default || window.__ultravoxModule.UltravoxSession;
        if (!UltravoxSession) {
            throw new Error('UltravoxSession not found');
        }

        // Get call details to get join URL
        const call = await apiRequest(`/api/calls/${currentChatId}`);
        const joinUrl = call.call.join_url || call.call.response_json.joinUrl;

        if (!joinUrl) {
            throw new Error('No join URL found');
        }

        // Create Ultravox session
        ultravoxSession = new UltravoxSession();

        // Listen for transcripts (agent responses)
        ultravoxSession.addEventListener('transcript', (event) => {
            if (event.role === 'agent' && event.medium === 'text' && event.final) {
                hideTypingIndicator();
                addMessage('agent', event.text);
                isWaitingForResponse = false;
                document.getElementById('sendBtn').disabled = false;
                document.getElementById('messageInput').disabled = false;
                document.getElementById('messageInput').focus();
            }
        });

        // Join the call
        await ultravoxSession.joinCall(joinUrl);

        isInitialized = true;
        console.log('Chat initialized:', currentChatId);

    } catch (error) {
        console.error('Failed to initialize chat:', error);
        throw error;
    }
}

// Add Message to UI
function addMessage(role, text) {
    // Remove welcome screen if present
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }

    const container = document.getElementById('messagesContainer');

    const messageGroup = document.createElement('div');
    messageGroup.className = 'message-group';

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'You' : 'AI';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';

    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = text;

    contentWrapper.appendChild(messageText);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentWrapper);
    messageGroup.appendChild(messageDiv);

    container.appendChild(messageGroup);

    // Scroll to bottom
    const messagesWrapper = document.getElementById('messagesWrapper');
    messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
}

// Show Typing Indicator
function showTypingIndicator() {
    const container = document.getElementById('messagesContainer');

    const messageGroup = document.createElement('div');
    messageGroup.className = 'message-group';
    messageGroup.id = 'typingIndicatorGroup';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message agent';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'AI';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator active';
    typingIndicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;

    contentWrapper.appendChild(typingIndicator);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentWrapper);
    messageGroup.appendChild(messageDiv);

    container.appendChild(messageGroup);

    const messagesWrapper = document.getElementById('messagesWrapper');
    messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
}

// Hide Typing Indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicatorGroup');
    if (indicator) {
        indicator.remove();
    }
}

// Send Message
async function sendMessage(messageText = null) {
    const input = document.getElementById('messageInput');
    const message = messageText || input.value.trim();

    if (!message || isWaitingForResponse) return;

    // Clear input if not from example prompt
    if (!messageText) {
        input.value = '';
        input.style.height = 'auto';
    }

    // Initialize chat if first message
    if (!isInitialized) {
        // Add user message first
        addMessage('user', message);

        // Disable input while initializing
        isWaitingForResponse = true;
        document.getElementById('sendBtn').disabled = true;
        input.disabled = true;

        showTypingIndicator();

        try {
            await initializeChat();

            // Now send the message
            await apiRequest(`/api/chats/${currentChatId}/messages`, 'POST', {
                message: message
            });

        } catch (error) {
            console.error('Failed to initialize or send message:', error);
            hideTypingIndicator();
            addMessage('agent', 'Sorry, I encountered an error. Please try again or refresh the page.');
            isWaitingForResponse = false;
            document.getElementById('sendBtn').disabled = false;
            input.disabled = false;
        }
        return;
    }

    // Add user message to UI
    addMessage('user', message);

    // Disable input while waiting
    isWaitingForResponse = true;
    document.getElementById('sendBtn').disabled = true;
    input.disabled = true;

    showTypingIndicator();

    try {
        // Send message to API
        await apiRequest(`/api/chats/${currentChatId}/messages`, 'POST', {
            message: message
        });

    } catch (error) {
        console.error('Failed to send message:', error);
        hideTypingIndicator();
        addMessage('agent', 'Sorry, I couldn\'t send your message. Please try again.');
        isWaitingForResponse = false;
        document.getElementById('sendBtn').disabled = false;
        input.disabled = false;
        input.focus();
    }
}

// Attach Example Prompt Handlers
function attachExamplePromptHandlers() {
    document.querySelectorAll('.example-prompt').forEach(prompt => {
        prompt.addEventListener('click', () => {
            const promptText = prompt.getAttribute('data-prompt');
            sendMessage(promptText);
        });
    });
}

// Event Listeners
document.getElementById('sendBtn').addEventListener('click', () => sendMessage());

document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
document.getElementById('messageInput').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

// Initialize example prompts
window.addEventListener('load', () => {
    attachExamplePromptHandlers();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (ultravoxSession) {
        try {
            ultravoxSession.leaveCall();
        } catch (e) {
            console.error('Error during cleanup:', e);
        }
    }
});
