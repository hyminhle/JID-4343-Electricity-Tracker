import React, { useState, useRef, useEffect } from 'react';
import './ChatbotDialog.css';

const ChatbotDialog = ({ onClose, theme = 'light' }) => {
  // State declarations
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [
      { 
        sender: 'bot', 
        text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for 2023-08-01'\n• 'Compare Building 210 with HQ'\n• 'List available buildings'"
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState('idle');
  const [apiEndpoint, setApiEndpoint] = useState('http://localhost:8080/completion');
  const [availableData, setAvailableData] = useState({});
  const [buildingOptions, setBuildingOptions] = useState([]);
  const messagesEndRef = useRef(null);

  // Fetch available buildings on component mount
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/get-available-data');
        const data = await response.json();
        setAvailableData(data);
        
        const buildings = Object.keys(data).map(building => decodeURIComponent(building));
        setBuildingOptions(buildings);
      } catch (error) {
        console.error('Error fetching available buildings:', error);
      }
    };

    fetchAvailableData();
  }, []);

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
        text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for 2023-08-01'\n• 'Compare Building 210 with HQ'\n• 'List available buildings'"
      }
    ]);
  };




  const handleDirectQuery = async (prompt) => {
    // 1. List buildings command
    if (prompt.toLowerCase().includes('list available buildings') || 
        prompt.toLowerCase().includes('what buildings are available')) {
      if (buildingOptions.length === 0) {
        return "No building data available. Please try again later.";
      }
      return `Available buildings:\n${buildingOptions.map(b => `• ${b}`).join('\n')}`;
    }
  
    // 2. Extract building identifier
    let buildingIdent = null;
    const buildingMatch = prompt.match(/building\s*(\d+)/i) || 
                         prompt.match(/(\d+)(?=\s*(usage|consumption|data|for|on|from))/i) ||
                         prompt.match(/\b(HQ|Headquarters|Main)\b/i);
    if (buildingMatch) buildingIdent = buildingMatch[1];
  
    // 3. Find matching building (case insensitive)
    let building = null;
    if (buildingIdent) {
      building = buildingOptions.find(b => {
        // Remove non-alphanumeric characters for comparison
        const cleanOption = b.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const cleanInput = buildingIdent.replace(/[^a-z0-9]/gi, '').toLowerCase();
        return cleanOption.includes(cleanInput);
      });
      
      if (!building) {
        return `Building "${buildingIdent}" not found. Available buildings: ${
          buildingOptions.slice(0, 5).join(', ')}${buildingOptions.length > 5 ? '...' : ''}`;
      }
    } else {
      return "Please specify a building name or number.";
    }
  
    // 4. Date parsing (supports multiple formats and relative dates)
    let date = new Date();
    const dateFormats = [
      { 
        regex: /(\d{4}-\d{2}-\d{2})/, 
        handler: (match) => {
          const [year, month, day] = match[0].split('-');
          return new Date(year, month-1, day); // month-1 to convert to JS 0-index
        } 
      },
      { 
        regex: /(\d{2}\/\d{2}\/\d{4})/, 
        handler: (match) => {
          const [month, day, year] = match[0].split('/');
          return new Date(year, month-1, day); // month-1 to convert to JS 0-index
        }
      },
      { regex: /today/i, handler: () => new Date() },
      { regex: /yesterday/i, handler: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
      }},
      { regex: /last\s*week/i, handler: () => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
      }},
      { regex: /last\s*month/i, handler: () => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d;
      }}
    ];
  
    for (const format of dateFormats) {
      const match = prompt.match(format.regex);
      if (match) {
        date = format.handler(match);
        break;
      }
    }
    if (isNaN(date.getTime())) {
      return "⚠️ Invalid date format. Please use YYYY-MM-DD or MM/DD/YYYY";
    }
    
    // Check for future dates
    if (date > new Date()) {
      return "⚠️ Future dates aren't available. Please select a date up to today.";
    }
    
    // Format date for display
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    // 5. Check if query is for raw data or analysis
    const wantsAnalysis = prompt.toLowerCase().includes('analyze') || 
                         prompt.toLowerCase().includes('insight') ||
                         prompt.toLowerCase().includes('compare');
  
    try {
    // Fixed API URL construction - use correct month indexing
    const apiMonth = date.getMonth() + 1;
    const apiDay = date.getDate();
    const apiYear = date.getFullYear();

    const consumptionResponse = await fetch(
      `http://127.0.0.1:5000/fetch-data/${apiYear}/${apiMonth}/${apiDay}/${encodeURIComponent(building)}`
    );
    
    if (!consumptionResponse.ok) {
      throw new Error(`No data available for ${building} on ${formattedDate}`);
    }
    
    const consumptionData = await consumptionResponse.json();
  
      // 7. Fetch stats data
      let statsData = null;
      try {
        const statsResponse = await fetch(
          `http://127.0.0.1:5000/stats/${date.getFullYear()}/${date.getMonth() + 1}/${encodeURIComponent(building)}`
        );
        if (statsResponse.ok) {
          statsData = await statsResponse.json();
        }
      } catch (statsError) {
        console.warn('Could not fetch stats:', statsError);
      }
  
      // 8. Format basic response
      const basicResponse = `
  Building: ${building}
  Date: ${date.toDateString()}
  Consumption: ${consumptionData.consumption} kWh
  ${statsData ? `
  Monthly Statistics:
  - Average: ${statsData.mean.toFixed(2)} kWh
  - Peak: ${statsData.highest.toFixed(2)} kWh
  - Lowest: ${statsData.lowest.toFixed(2)} kWh
  ` : ''}`.trim();
  
      // 9. Return basic data or prepare for AI analysis
      if (!wantsAnalysis) {
        return basicResponse;
      }
  
      // 10. Prepare for LLM analysis
      return {
        analysisRequired: true,
        data: {
          building,
          date: date.toISOString(),
          consumption: consumptionData.consumption,
          stats: statsData,
          availableBuildings: buildingOptions
        },
        analysisPrompt: `Analyze electricity usage with these rules:
  1. Compare ${building}'s usage (${consumptionData.consumption}kWh) to its monthly average (${statsData?.mean.toFixed(2)}kWh)
  2. Highlight any anomalies (${statsData ? `current is ${((consumptionData.consumption - statsData.mean)/statsData.mean * 100).toFixed(1)}% from average` : 'no stats available'})
  3. Suggest energy saving tips if usage is above average
  4. Format response with bullet points
  
  Data:
  ${basicResponse}`
      };
  
    } catch (error) {
      console.error('Query error:', error);
      return `⚠️ Error: ${error.message}`;
    }
  };
  const fetchLlamaResponse = async (prompt) => {
    setIsLoading(true);
    setModelStatus('loading');
    
    try {
      setMessages(prev => [...prev, { sender: 'user', text: prompt }]);
      
      // Handle direct data queries
      const directResponse = await handleDirectQuery(prompt);
      if (directResponse) {
        if (directResponse.analysisRequired) {
          // Send data to LLM for analysis
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: directResponse.analysisPrompt,
              temperature: 0.3,
              max_tokens: 500
            })
          });

          const data = await response.json();
          const analysis = data.content.trim();
          
          setMessages(prev => [
            ...prev,
            { 
              sender: 'bot', 
              text: `🔍 Analysis for ${directResponse.data.consumptionData.building} on ${directResponse.data.consumptionData.date}:\n${analysis}`
            }
          ]);
        } else {
          setMessages(prev => [...prev, { sender: 'bot', text: directResponse }]);
        }
        setModelStatus('idle');
        return;
      }

      // ... (rest of existing LLM code)
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: `⚠️ Error: ${error.message || 'Failed to process request'}`
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
              className="control-btn" 
              onClick={() => setApiEndpoint(prompt('Enter API endpoint:', apiEndpoint))}
              title="Change API endpoint"
            >
              ⚙️
            </button>
            <button 
              className="control-btn" 
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button 
              className="control-btn" 
              onClick={clearConversation}
              title="Clear conversation"
            >
              🗑️
            </button>
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