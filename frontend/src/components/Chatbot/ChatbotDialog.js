import React, { useState, useRef, useEffect } from 'react';
import './ChatbotDialog.css';

const ChatbotDialog = ({ onClose, theme = 'light' }) => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [
      { 
        sender: 'bot', 
        text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for 2024-08-01'\n• 'Compare Building 210 with HQ'\n• 'List available buildings'"
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState('idle');
  const [apiEndpoint, setApiEndpoint] = useState('http://localhost:8080/completion');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.setAttribute('data-theme', newTheme);
    if (newTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  const clearConversation = () => {
    setMessages([
      { 
        sender: 'bot', 
        text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for 2024-08-01'\n• 'Compare Building 210 with HQ'\n• 'List available buildings'"
      }
    ]);
  };

  const fetchLlamaResponse = async (prompt) => {
    setIsLoading(true);
    setModelStatus('loading');
    try {
      // First add the user message to the chat
      setMessages(prev => [...prev, { sender: 'user', text: prompt }]);
      
      const systemPrompt = `You are an expert assistant for electricity consumption tracking. 
      Your role is to:
      - Analyze electricity usage data
      - Compare building consumption
      - Provide energy efficiency insights
      - Never discuss unrelated topics
      
      Only respond to queries about:
      - Electricity usage
      - Building consumption
      - Energy metrics
      - Cost analysis
      
      If asked unrelated questions, respond:
      "I specialize in electricity consumption tracking. How can I help with energy data?"`;

      const conversationHistory = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.sender === 'bot' ? 'assistant' : 'user',
          content: msg.text
        })),
        { role: 'user', content: prompt }
      ];

      // Format for llama.cpp
      const llamaPrompt = conversationHistory.map(m => {
        if (m.role === 'system') return `[INST] <<SYS>>\n${m.content}\n<</SYS>>\n\n`;
        return `${m.role === 'user' ? '[INST] ' : ''}${m.content}${m.role === 'user' ? ' [/INST]' : ''}`;
      }).join('\n');

      const startTime = performance.now();
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: llamaPrompt,
          temperature: 0.7,
          max_tokens: 1024,
          top_k: 40,
          top_p: 0.9,
          repeat_penalty: 1.1,
          presence_penalty: 0.2,
          frequency_penalty: 0.2,
          tfs_z: 0.95,
          typical_p: 0.95,
          mirostat: 2,
          mirostat_tau: 4.0,
          mirostat_eta: 0.1,
          stop: ['[INST]', '[/INST]', '<|im_end|>'],
          n_predict: 1024,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botResponse = data.content.trim();
      const endTime = performance.now();
      console.log(`Response time: ${(endTime - startTime).toFixed(0)}ms`);
      
      // Add the bot's response to the chat
      setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
      setModelStatus('idle');
    } catch (error) {
      console.error('Error calling llama.cpp:', error);
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: `⚠️ Error: ${error.message || 'Failed to get response from the AI server. Is llama.cpp running?'}`
      }]);
      setModelStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    await fetchLlamaResponse(inputText.trim());
    setInputText('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`chatbot-dialog ${theme}`}>
      <div className="chatbot-container">
        <div className="chatbot-header">
          <div className="chatbot-avatar">
            <span>⚡</span>
          </div>
          <div className="chatbot-title">
            <h3>Electricity Tracker</h3>
          </div>
          <div className="chatbot-controls">
            <button 
              className="settings-button" 
              onClick={() => setApiEndpoint(prompt('Enter llama.cpp API endpoint:', apiEndpoint))}
              title="Change API endpoint"
            >
              ⚙️
            </button>
            <button 
              className="theme-toggle" 
              onClick={toggleTheme} 
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button className="clear-button" onClick={clearConversation} title="Clear conversation">
              🗑️
            </button>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>
        
        <div className="chatbot-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.sender}`}>
              {msg.sender === 'bot' && <div className="message-avatar">⚡</div>}
              <div className="message-bubble">
                {msg.text.split('\n').map((line, j) => (
                  <React.Fragment key={j}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
          
          {modelStatus === 'loading' && (
            <div className="message bot">
              <div className="message-avatar">⚡</div>
              <div className="message-bubble typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          {modelStatus === 'error' && (
            <div className="message bot error">
              <div className="message-avatar">⚠️</div>
              <div className="message-bubble">
                Sorry, I'm having trouble responding. Please try again.
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className="chatbot-input">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about electricity usage..."
            disabled={isLoading}
            rows="1"
          />
          <button 
            onClick={handleSendMessage} 
            disabled={!inputText.trim() || isLoading}
            className={isLoading ? 'loading' : ''}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
              <path d="M0 0h24v24H0V0z" fill="none"/>
              <path d="M3.4 20.4l17.45-7.48c.81-.35.81-1.49 0-1.84L3.4 3.6c-.66-.29-1.39.2-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotDialog;