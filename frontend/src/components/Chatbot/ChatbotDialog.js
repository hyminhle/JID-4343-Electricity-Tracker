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
  const messagesEndRef = useRef(null);

  // Save conversation to localStorage
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearConversation = () => {
    setMessages([
      { 
        sender: 'bot', 
        text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for 2024-08-01'\n• 'Compare Building 210 with HQ'\n• 'List available buildings'" 
      }
    ]);
  };

  const fetchBuildingInsights = async (building, date) => {
    try {
      // First try the new chatbot endpoint
      let response = await fetch(
        `http://localhost:5000/api/chatbot/consumption?building=${encodeURIComponent(building)}&date=${date}`
      );
      
      // If the new endpoint fails, try the old one
      if (!response.ok) {
        response = await fetch(
          `http://localhost:5000/api/consumption?building=${encodeURIComponent(building)}&date=${date}`
        );
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Data not found for this building and date');
      }
      
      const data = await response.json();
      
      // Ensure the response has required fields
      if (!data.building || !data.date) {
        throw new Error('Incomplete data received from server');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw new Error(error.message || 'Failed to fetch data. Please check the building name and date format.');
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText;
    setInputText('');
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Handle special commands
      if (userMessage.toLowerCase().includes('list buildings')) {
        const response = await fetch('http://localhost:5000/api/buildings');
        const buildings = await response.json();
        const buildingList = buildings.map(b => `• ${b.name} (${b.data_start} to ${b.data_end})`).join('\n');
        addBotMessage(`🏢 Available Buildings:\n${buildingList}`);
        return;
      }

      // Try to extract building and date directly
      const buildingMatch = userMessage.match(/(building\s*\d+|hq)/i);
      const dateMatch = userMessage.match(/(\d{4}-\d{2}-\d{2}|yesterday|today)/i);
      
      if (buildingMatch && dateMatch) {
        const building = buildingMatch[0].toUpperCase().replace(/\s+/g, ' ');
        let date = dateMatch[0];
        
        // Handle relative dates
        if (date.toLowerCase() === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          date = yesterday.toISOString().split('T')[0];
        } else if (date.toLowerCase() === 'today') {
          date = new Date().toISOString().split('T')[0];
        }

        // Add loading message
        const loadingId = Date.now();
        setMessages(prev => [...prev, { 
          sender: 'bot', 
          text: `⏳ Fetching data for ${building} on ${date}...`,
          tempId: loadingId 
        }]);

        // Get data from backend
        const data = await fetchBuildingInsights(building, date);
        const response = formatResponse(data);

        // Replace loading message
        setMessages(prev => prev.map(msg => 
          msg.tempId === loadingId ? { sender: 'bot', text: response } : msg
        ));
        return;
      }

      // If direct extraction fails, show help
      addBotMessage(`Please specify both a building and date. Examples:\n• "Building 110 2024-08-01"\n• "Show HQ usage for yesterday"\n• "Compare Building 210 with HQ"`);

    } catch (error) {
      console.error('Error:', error);
      addBotMessage(`⚠️ ${error.message}\n\nTry one of these formats:\n• "Building 110 2024-08-01"\n• "Show HQ usage for yesterday"`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatResponse = (data) => {
    return `🏢 ${data.building} on ${data.date}:
🔋 Usage: ${data.consumption?.toLocaleString() || 'N/A'} kWh
💵 Cost: $${data.cost || 'N/A'}
📊 Compared to average: ${data.comparison || 'N/A'}

💡 ${data.insights?.join('\n') || 'No insights available'}`;
  };

  const addBotMessage = (text) => {
    setMessages(prev => [...prev, { sender: 'bot', text }]);
  };

  return (
    <div className={`chatbot-dialog ${theme}`}>
      <div className="chatbot-container">
        <div className="chatbot-header">
          <div className="chatbot-avatar">⚡</div>
          <h3>Electricity Consumption Assistant</h3>
          <div className="chatbot-controls">
            <button className="clear-button" onClick={clearConversation} title="Clear conversation">
              🗑️
            </button>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>
        
        <div className="chatbot-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.sender}`}>
              {msg.sender === 'bot' && <div className="avatar">⚡</div>}
              <div className="bubble">
                {msg.text.split('\n').map((line, j) => (
                  <React.Fragment key={j}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chatbot-input">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Ask about electricity usage..."
            disabled={isLoading}
          />
          <button 
            onClick={handleSendMessage} 
            disabled={!inputText.trim() || isLoading}
            className={isLoading ? 'loading' : ''}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotDialog;