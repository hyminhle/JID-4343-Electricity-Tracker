import React, { useState, useRef, useEffect } from 'react';
import './ChatbotDialog.css';

const ChatbotDialog = ({ onClose, theme = 'light' }) => {
  const [step, setStep] = useState('intro');
  const [selectedOption, setSelectedOption] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    // Update theme in localStorage
    localStorage.setItem('theme', newTheme);
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.setAttribute('data-theme', newTheme);
    
    // Apply class-based approach as well
    if (newTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    setStep('chat');
    
    // Add the selected option as a user message
    addMessage('user', `I need help with ${option}`);
    
    // Add a bot response
    setTimeout(() => {
      addMessage('bot', `I'll help you with your ${option} inquiry. What specific information do you need?`);
    }, 500);
  };

  const addMessage = (sender, text) => {
    setMessages(prev => [...prev, { sender, text }]);
  };

  const handleSendMessage = () => {
    if (inputText.trim() === '') return;
    
    // Add user message
    addMessage('user', inputText);
    setInputText('');
    
    // Placeholder for when LLM integration is added
    setTimeout(() => {
      addMessage('bot', 'Thanks for your message. Our team is working on integrating the LLM chatbot. This is a placeholder response.');
    }, 800);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return (
          <>
            <div className="chatbot-header">
              <div className="chatbot-avatar">
                <span>⚡</span>
              </div>
              <div className="chatbot-title">
                <h3>Electricity Tracker</h3>
              </div>
              <button 
                className="theme-toggle" 
                onClick={toggleTheme} 
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button className="close-button" onClick={onClose}>×</button>
            </div>
            <div className="chatbot-message">
              <p>Click the green button below to begin.</p>
            </div>
            <div className="chatbot-actions">
              <button className="start-button" onClick={() => setStep('options')}>
                Get Started
              </button>
            </div>
          </>
        );
      
      case 'options':
        return (
          <>
            <div className="chatbot-header">
              <div className="chatbot-avatar">
                <span>⚡</span>
              </div>
              <div className="chatbot-title">
                <h3>Electricity Tracker</h3>
              </div>
              <button 
                className="theme-toggle" 
                onClick={toggleTheme} 
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button className="close-button" onClick={onClose}>×</button>
            </div>
            <div className="chatbot-message">
              <p>Choose from the options below to help us understand your issue better.</p>
              <p>
                You will be provided with detailed information about your electricity consumption
                after you select the option that best describes your situation.
              </p>
              <p>Please note, this chat will automatically close if you are unresponsive for 10 minutes.</p>
            </div>
            <div className="option-buttons">
              <button 
                className="option-button" 
                onClick={() => handleOptionSelect('consumption')}
              >
                <span className="option-icon">📊</span> Consumption Analysis
              </button>
              <button 
                className="option-button" 
                onClick={() => handleOptionSelect('billing')}
              >
                <span className="option-icon">💰</span> Billing Issues
              </button>
              <button 
                className="option-button" 
                onClick={() => handleOptionSelect('tips')}
              >
                <span className="option-icon">💡</span> Energy Saving Tips
              </button>
              <button 
                className="option-button" 
                onClick={() => handleOptionSelect('forecast')}
              >
                <span className="option-icon">📈</span> Usage Forecast
              </button>
              <button 
                className="option-button" 
                onClick={() => handleOptionSelect('settings')}
              >
                <span className="option-icon">⚙️</span> Account Settings
              </button>
            </div>
          </>
        );
      
      case 'chat':
        return (
          <>
            <div className="chatbot-header">
              <div className="chatbot-avatar">
                <span>⚡</span>
              </div>
              <div className="chatbot-title">
                <h3>Electricity Tracker</h3>
              </div>
              <button 
                className="theme-toggle" 
                onClick={toggleTheme} 
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button className="close-button" onClick={onClose}>×</button>
            </div>
            <div className="chatbot-messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender}`}>
                  {msg.sender === 'bot' && (
                    <div className="message-avatar">⚡</div>
                  )}
                  <div className="message-bubble">
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="chatbot-input">
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here..."
                rows="1"
              />
              <button 
                className="send-button"
                onClick={handleSendMessage}
                disabled={inputText.trim() === ''}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
                  <path d="M0 0h24v24H0V0z" fill="none"/>
                  <path d="M3.4 20.4l17.45-7.48c.81-.35.81-1.49 0-1.84L3.4 3.6c-.66-.29-1.39.2-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/>
                </svg>
              </button>
            </div>
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="chatbot-dialog">
      <div className="chatbot-container">
        {renderContent()}
      </div>
    </div>
  );
};

export default ChatbotDialog; 