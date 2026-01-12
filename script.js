/**
 * Mock LLM Logic for demonstration.
 * In a real app, this would call the Gemini API.
 */
class MockLLM {
    constructor() { }

    async generate(prompt, context) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 1000));

        const promptLower = prompt.toLowerCase();

        // Simple heuristic responses based on Context + Input
        if (context.role === 'Vegan Chef') {
            if (promptLower.includes('cook') || promptLower.includes('recipe')) {
                return "Based on your role as a Vegan Chef, I recommend a Quinoa & Black Bean Salad. It's high in protein and fits your 'Healthy' goal.";
            }
        }

        if (promptLower.includes('plan') && context.goal.includes('party')) {
            return "Since you're planning a party, let's start with a guest list and a theme. How about a 'Future Tech' theme?";
        }

        return `I understand you are ${context.role} with a goal to ${context.goal}. Here is some advice: focus on small steps. (Mock LLM response)`;
    }

    async suggestFollowUps(lastResponse, context) {
        // Return 3 relevant short questions
        const suggestions = [
            "Tell me more details",
            "What are the alternatives?",
            `How does this help my goal: ${context.goal}?`
        ];

        if (lastResponse.includes('recipe')) {
            return ["Shopping list?", "Prep time?", "Spicy variation?"];
        }

        return suggestions;
    }
}

/**
 * ReAct Agent Class
 * Simulates: Thought -> Act -> Observation
 */
class ReActAgent {
    constructor(llm) {
        this.llm = llm;
        this.context = {
            role: 'User',
            goal: 'General',
            prefs: ''
        };
    }

    setContext(newContext) {
        this.context = { ...this.context, ...newContext };
        this.saveContext();
    }

    loadContext() {
        const saved = localStorage.getItem('gemini_context');
        if (saved) {
            this.context = JSON.parse(saved);
        }
        return this.context;
    }

    saveContext() {
        localStorage.setItem('gemini_context', JSON.stringify(this.context));
    }

    async process(userInput, callbacks) {
        const { onThought, onMessage } = callbacks;

        // Step 1: Thought
        onThought(`Analyzing request: "${userInput}" against Context: [Role: ${this.context.role}, Goal: ${this.context.goal}]...`);

        await new Promise(r => setTimeout(r, 600)); // Simulate thinking

        // Step 2: Action / Generation
        const response = await this.llm.generate(userInput, this.context);

        // Step 3: Final Response
        onMessage(response);

        return response;
    }
}

// --- UI CONTROLLER ---

document.addEventListener('DOMContentLoaded', () => {
    const llm = new MockLLM();
    const agent = new ReActAgent(llm);

    // Elements
    const chatStream = document.getElementById('chat-stream');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const suggestionChips = document.getElementById('suggestion-chips');

    // Settings Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsOverlay = document.getElementById('settings-overlay');
    const closeSettings = document.getElementById('close-settings');
    const saveContextBtn = document.getElementById('save-context-btn');

    // Inputs
    const ctxRole = document.getElementById('ctx-role');
    const ctxGoal = document.getElementById('ctx-goal');
    const ctxPrefs = document.getElementById('ctx-prefs');
    const activeContextDisplay = document.getElementById('active-context-display');

    // Init
    const savedCtx = agent.loadContext();
    updateUIContext(savedCtx);

    // Event Listeners
    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    settingsBtn.addEventListener('click', () => {
        // Populate fields
        ctxRole.value = agent.context.role;
        ctxGoal.value = agent.context.goal;
        ctxPrefs.value = agent.context.prefs;
        settingsOverlay.classList.remove('hidden');
    });

    closeSettings.addEventListener('click', () => {
        settingsOverlay.classList.add('hidden');
    });

    saveContextBtn.addEventListener('click', () => {
        const newCtx = {
            role: ctxRole.value || 'User',
            goal: ctxGoal.value || 'General',
            prefs: ctxPrefs.value || ''
        };
        agent.setContext(newCtx);
        updateUIContext(newCtx);
        settingsOverlay.classList.add('hidden');
        addSystemMessage("Context updated! my responses will now be tailored to you.");
    });

    // Validations / Functions
    function updateUIContext(ctx) {
        activeContextDisplay.textContent = `${ctx.role} • ${ctx.goal}`;
    }

    async function handleSend() {
        const text = userInput.value.trim();
        if (!text) return;

        // Add User Message
        addMessage(text, 'user');
        userInput.value = '';
        suggestionChips.innerHTML = ''; // Clear old chips

        // Agent Process
        const response = await agent.process(text, {
            onThought: (thoughtText) => {
                addMessage(thoughtText, 'thought');
            },
            onMessage: (msgText) => {
                addMessage(msgText, 'system');
            }
        });

        // Generate Follow-ups
        const suggestions = await llm.suggestFollowUps(response, agent.context);
        renderSuggestions(suggestions);
    }

    function addMessage(text, type) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.textContent = text;
        chatStream.appendChild(div);
        chatStream.scrollTop = chatStream.scrollHeight;
    }

    function addSystemMessage(text) {
        addMessage(text, 'system');
    }

    function renderSuggestions(list) {
        suggestionChips.innerHTML = '';
        list.forEach(txt => {
            const btn = document.createElement('button');
            btn.className = 'chip';
            btn.textContent = txt;
            btn.onclick = () => {
                userInput.value = txt;
                handleSend();
            };
            suggestionChips.appendChild(btn);
        });
    }
});
