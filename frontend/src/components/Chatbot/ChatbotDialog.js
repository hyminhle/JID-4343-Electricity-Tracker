import React, { useState, useRef, useEffect } from 'react';
import './ChatbotDialog.css';

const ChatbotDialog = ({ onClose, theme = 'light' }) => {
  const [messages, setMessages] = useState(() => {
    // Load saved conversation from localStorage
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [
      { 
        sender: 'bot', 
        text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for yesterday'\n• 'Compare Building 210 with HQ'\n• 'List available buildings'" 
      }
    ];
  });
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState({
    lastBuilding: null,
    lastDate: null
  });
  const messagesEndRef = useRef(null);

  // Save conversation to localStorage
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(messages));
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const fetchBuildingInsights = async (building, date) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/chatbot/consumption?building=${encodeURIComponent(building)}&date=${date}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch data');
      }
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw new Error(error.message || 'Failed to process your request');
    }
  };
  const fetchLlamaResponse = async (prompt) => {
    try {
      const response = await fetch('http://localhost:8080/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          temperature: 0.3,
          max_tokens: 150,
          stop: ['\n', '}'] // Ensure response ends with complete JSON
        })
      });
      
      const text = await response.text();
      
      // Clean the response to ensure valid JSON
      let cleanedText = text.trim();
      
      // Sometimes Llama adds extra text after JSON
      const jsonStart = cleanedText.indexOf('{');
      const jsonEnd = cleanedText.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > 0) {
        cleanedText = cleanedText.substring(jsonStart, jsonEnd);
      }
      
      // Handle cases where Llama adds extra characters
      cleanedText = cleanedText.replace(/^[^{]*/, ''); // Remove anything before {
      cleanedText = cleanedText.replace(/[^}]*$/, ''); // Remove anything after }
      
      // Parse the cleaned JSON
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error('LLAMA Parsing Error:', error);
      throw new Error('Failed to process the response. Please try again.');
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

      // Extract entities using LLM with conversation context
      const extractionPrompt = `Current context: ${JSON.stringify(conversationContext)}\n` +
        `Extract from: "${userMessage}":\n` +
        `- building (must be: Building 110, Building 210, HQ)\n` +
        `- date (as YYYY-MM-DD, or relative like "yesterday")\n` +
        `Respond ONLY with JSON like: {"building": "...", "date": "...", "action": "compare/forecast/etc"}`;

      const extraction = await fetchLlamaResponse(extractionPrompt);
      const { building, date, action } = JSON.parse(extraction.content);
      
      if (!building || !date) {
        addBotMessage("Please specify a building and date. Try: 'Show HQ usage for yesterday'");
        return;
      }

      // Update context
      setConversationContext(prev => ({
        ...prev,
        lastBuilding: building,
        lastDate: date
      }));

      // Add loading message
      const loadingId = Date.now();
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: `⏳ Fetching ${building} data for ${date}...`,
        tempId: loadingId 
      }]);

      // Get data from backend
      const data = await fetchBuildingInsights(building, date);
      
      // Format response based on action
      let response;
      if (action === 'compare') {
        response = formatComparison(data, userMessage);
      } else {
        response = formatInsights(data);
      }

      // Replace loading message
      setMessages(prev => prev.map(msg => 
        msg.tempId === loadingId ? { sender: 'bot', text: response } : msg
      ));

    } catch (error) {
      console.error('Error:', error);
      addBotMessage(`Sorry, I encountered an error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addBotMessage = (text) => {
    setMessages(prev => [...prev, { sender: 'bot', text }]);
  };

  const formatInsights = (data) => {
    return `🏢 ${data.building} on ${data.date}:
🔋 Usage: ${data.consumption?.toLocaleString() || 'N/A'} kWh
💵 Cost: $${data.cost || 'N/A'}
📊 Compared to monthly average: ${data.comparison || 'N/A'}

💡 ${data.insights?.join('\n') || 'No insights available'}

🛠️ Try:
• "Compare with Building 210"
• "Show last week's data"
• "Explain this usage pattern"`;
  };

  const formatComparison = (data, userMessage) => {
    // Implement your comparison logic here
    return `📊 Comparison:
${data.building}: ${data.consumption} kWh
VS
${userMessage.includes('210') ? 'Building 210' : 'HQ'}: [comparison data] kWh`;
  };

  return (
    <div className={`chatbot-dialog ${theme}`}>
      <div className="chatbot-container">
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
          <button onClick={handleSendMessage} disabled={!inputText.trim() || isLoading}>
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotDialog;