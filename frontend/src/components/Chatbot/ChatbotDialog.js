import React, { useState, useRef, useEffect } from 'react';
import './ChatbotDialog.css';

const ChatbotDialog = ({ onClose, theme = 'light' }) => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [
      { 
        sender: 'bot', 
        text: "Hello! I'm your local AI assistant for electricity consumption. How can I help you today?"
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

  const clearConversation = () => {
    setMessages([
      { 
        sender: 'bot', 
        text: "Hello! I'm your local AI assistant for electricity consumption. How can I help you today?"
      }
    ]);
  };

  const fetchLlamaResponse = async (prompt) => {
    setIsLoading(true);
    setModelStatus('loading');
    try {
      // First add the user message to the chat
      setMessages(prev => [...prev, { sender: 'user', text: prompt }]);
      
      // Create the full conversation history with proper formatting
      const systemPrompt = `You are a helpful, respectful, and honest assistant that is made to assist in electricity consumption of the sugar land campus. 
      Always answer as helpfully as possible, while being safe. 
      Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. 
      If a question does not make any sense, explain why instead of answering something incorrect. `;

      const conversationHistory = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.sender === 'bot' ? 'assistant' : 'user',
          content: msg.text
        })),
        { role: 'user', content: prompt }
      ];

      // Format for llama.cpp (different from OpenAI)
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

  return (
    <div className={`chatbot-dialog ${theme}`}>
      <div className="chatbot-container">
        <div className="chatbot-header">
          <div className="chatbot-avatar">🦙</div>
          <h3>Llama.cpp Chatbot</h3>
          <div className="chatbot-controls">
            <button 
              className="settings-button" 
              onClick={() => setApiEndpoint(prompt('Enter llama.cpp API endpoint:', apiEndpoint))}
              title="Change API endpoint"
            >
              ⚙️
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
              {msg.sender === 'bot' && <div className="avatar">🦙</div>}
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
          
          {modelStatus === 'loading' && (
            <div className="message bot">
              <div className="avatar">🦙</div>
              <div className="bubble typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          {modelStatus === 'error' && (
            <div className="message bot error">
              <div className="avatar">⚠️</div>
              <div className="bubble">
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
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Type your message..."
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
// const ChatbotDialog = ({ onClose, theme = 'light' }) => {
//   const [messages, setMessages] = useState(() => {
//     const saved = localStorage.getItem('chatHistory');
//     return saved ? JSON.parse(saved) : [
//       { 
//         sender: 'bot', 
//         text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for 2024-08-01'\n• 'Compare Building 210 with HQ'\n• 'List available buildings'" 
//       }
//     ];
//   });

//   const [inputText, setInputText] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const messagesEndRef = useRef(null);

//   useEffect(() => {
//     localStorage.setItem('chatHistory', JSON.stringify(messages));
//   }, [messages]);

//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   const clearConversation = () => {
//     setMessages([
//       { 
//         sender: 'bot', 
//         text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for 2024-08-01'\n• 'Compare Building 210 with HQ'\n• 'List available buildings'" 
//       }
//     ]);
//   };

//   const fetchLlamaResponse = async (prompt) => {
//     try {
//       const response = await fetch('http://localhost:8080/completion', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           prompt: prompt,
//           temperature: 0.2,
//           max_tokens: 200,
//           stop: ['\n', '}'],
//           top_p: 0.9,
//           repeat_penalty: 1.2
//         })
//       });
//       const text = await response.text();
//       const jsonStart = text.indexOf('{');
//       const jsonEnd = text.lastIndexOf('}') + 1;
//       const jsonString = jsonStart >= 0 && jsonEnd > 0 ? text.slice(jsonStart, jsonEnd) : '{}';
//       return JSON.parse(jsonString);
//     } catch (error) {
//       console.error('LLAMA Error:', error);
//       throw new Error('Failed to process your request. Please try again.');
//     }
//   };

//   const fetchBuildingData = async (building, date) => {
//     try {
//       const endpoints = [
//         `http://localhost:5000/api/chatbot/consumption?building=${encodeURIComponent(building)}&date=${date}`,
//         `http://localhost:5000/api/consumption?building=${encodeURIComponent(building)}&date=${date}`,
//         `http://localhost:5000/fetch-data/${date.split('-')[0]}/${date.split('-')[1]}/${date.split('-')[2]}/${encodeURIComponent(building)}`
//       ];
//       let lastError = null;
//       for (const endpoint of endpoints) {
//         try {
//           const response = await fetch(endpoint);
//           if (!response.ok) {
//             const error = await response.json().catch(() => ({}));
//             throw new Error(error.message || `HTTP error! status: ${response.status}`);
//           }
//           const data = await response.json();
//           if (!data.building && !data.consumption) {
//             throw new Error('Invalid data structure received');
//           }
//           return {
//             building: data.building || building,
//             date: data.date || date,
//             consumption: data.consumption,
//             cost: data.cost || (data.consumption * 0.12).toFixed(2),
//             comparison: data.comparison || 'No comparison data',
//             insights: data.insights || ['No insights available']
//           };
//         } catch (error) {
//           console.log(`Failed with endpoint ${endpoint}:`, error);
//           lastError = error;
//           continue;
//         }
//       }
//       throw lastError || new Error('All API endpoints failed');
//     } catch (error) {
//       console.error('API Error:', error);
//       throw new Error(error.message || 'Failed to fetch data. Please check the building name and date format.');
//     }
//   };

//   const parseDate = (dateStr) => {
//     if (dateStr.toLowerCase() === 'yesterday') {
//       const yesterday = new Date();
//       yesterday.setDate(yesterday.getDate() - 1);
//       return yesterday.toISOString().split('T')[0];
//     } else if (dateStr.toLowerCase() === 'today') {
//       return new Date().toISOString().split('T')[0];
//     }
//     return dateStr;
//   };

//   const generateComparison = (data1, data2) => {
//     return `
//       📊 Comparison between ${data1.building} and ${data2.building} on ${data1.date}:
//       - ${data1.building}: ${data1.consumption?.toLocaleString() || 'N/A'} kWh ($${data1.cost || 'N/A'})
//       - ${data2.building}: ${data2.consumption?.toLocaleString() || 'N/A'} kWh ($${data2.cost || 'N/A'})
//       Difference: ${Math.abs((data1.consumption || 0) - (data2.consumption || 0)).toLocaleString()} kWh
//     `;
//   };

//   const formatResponse = (data) => {
//     return `🏢 ${data.building} on ${data.date}:
//     🔋 Usage: ${data.consumption?.toLocaleString() || 'N/A'} kWh
//     💵 Cost: $${data.cost || 'N/A'}
//     📊 ${data.comparison || 'No comparison data'}
//     💡 ${data.insights.join('\n')}`;
//   };

//   const handleSendMessage = async () => {
//     if (!inputText.trim() || isLoading) return;

//     const userMessage = inputText.trim(); // ✅ Declare userMessage here
//     setInputText('');
//     setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
//     setIsLoading(true);

//     try {
//       if (userMessage.toLowerCase().includes('list buildings')) {
//         try {
//           const response = await fetch('http://localhost:5000/api/buildings');
//           if (!response.ok) throw new Error('Failed to fetch buildings');
//           const buildings = await response.json();
//           const buildingList = buildings.map(b => `• ${b.name} (${b.data_start} to ${b.data_end})`).join('\n');
//           addBotMessage(`🏢 Available Buildings:\n${buildingList}`);
//         } catch (error) {
//           addBotMessage(`⚠️ Could not fetch building list. Try again later.`);
//         }
//         return;
//       }

//       const buildingMatch = userMessage.match(/(building\s*\d+|hq)/i);
//       const dateMatch = userMessage.match(/(\d{4}-\d{2}-\d{2}|yesterday|today)/i);

//       if (buildingMatch && dateMatch) {
//         const building = buildingMatch[0].toUpperCase().replace(/\s+/g, ' ');
//         let date = dateMatch[0];

//         if (date.toLowerCase() === 'yesterday') {
//           const yesterday = new Date();
//           yesterday.setDate(yesterday.getDate() - 1);
//           date = yesterday.toISOString().split('T')[0];
//         } else if (date.toLowerCase() === 'today') {
//           date = new Date().toISOString().split('T')[0];
//         }

//         const loadingId = Date.now();
//         setMessages(prev => [...prev, {
//           sender: 'bot',
//           text: `⏳ Fetching data for ${building} on ${date}...`,
//           tempId: loadingId
//         }]);

//         const data = await fetchBuildingData(building, date);
//         const response = formatResponse(data);

//         setMessages(prev => prev.map(msg =>
//           msg.tempId === loadingId ? { sender: 'bot', text: response } : msg
//         ));
//         return;
//       }

//       if (userMessage.toLowerCase().includes('compare')) {
//         const parts = userMessage.match(/compare\s+(.*?)\s+with\s+(.*?)\s+(?:on|for)\s+(.*)/i);
//         if (parts && parts.length === 4) {
//           const [_, building1, building2, dateStr] = parts;
//           const date = parseDate(dateStr);

//           const loadingId = Date.now();
//           setMessages(prev => [...prev, {
//             sender: 'bot',
//             text: `⏳ Comparing ${building1} with ${building2} on ${date}...`,
//             tempId: loadingId
//           }]);

//           const data1 = await fetchBuildingData(building1.trim().toUpperCase(), date);
//           const data2 = await fetchBuildingData(building2.trim().toUpperCase(), date);

//           const comparison = generateComparison(data1, data2);

//           setMessages(prev => prev.map(msg =>
//             msg.tempId === loadingId ? { sender: 'bot', text: comparison } : msg
//           ));
//           return;
//         }
//         addBotMessage("To compare buildings, please specify:\n• First building\n• Second building\n• Date\nExample: 'Compare Building 110 with HQ for 2024-08-01'");
//         return;
//       }

//       const llamaResponse = await fetchLlamaResponse(`Extract intent, building(s), and date from: ${userMessage}`);
//       if (llamaResponse.intent === 'show') {
//         const { building, date } = llamaResponse;
//         const data = await fetchBuildingData(building.toUpperCase(), date);
//         addBotMessage(formatResponse(data));
//       } else if (llamaResponse.intent === 'compare') {
//         const { building1, building2, date } = llamaResponse;
//         const data1 = await fetchBuildingData(building1.toUpperCase(), date);
//         const data2 = await fetchBuildingData(building2.toUpperCase(), date);
//         addBotMessage(generateComparison(data1, data2));
//       } else {
//         addBotMessage("I didn't understand. Try listing buildings, showing usage, or comparing.");
//       }
//     } catch (error) {
//       console.error('Error:', error);
//       addBotMessage(`⚠️ Error: ${error.message || 'Something went wrong. Please try again.'}`);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const addBotMessage = (text) => {
//     setMessages(prev => [...prev, { sender: 'bot', text }]);
//   };

//   return (
//     <div className={`chatbot-dialog ${theme}`}>
//       <div className="chatbot-container">
//         <div className="chatbot-header">
//           <div className="chatbot-avatar">⚡</div>
//           <h3>Electricity Consumption Assistant</h3>
//           <div className="chatbot-controls">
//             <button className="clear-button" onClick={clearConversation} title="Clear conversation">
//               🗑️
//             </button>
//             <button className="close-button" onClick={onClose}>×</button>
//           </div>
//         </div>
//         <div className="chatbot-messages">
//           {messages.map((msg, i) => (
//             <div key={i} className={`message ${msg.sender}`}>
//               {msg.sender === 'bot' && <div className="avatar">⚡</div>}
//               <div className="bubble">
//                 {msg.text.split('\n').map((line, j) => (
//                   <React.Fragment key={j}>
//                     {line}
//                     <br />
//                   </React.Fragment>
//                 ))}
//               </div>
//             </div>
//           ))}
//           <div ref={messagesEndRef} />
//         </div>
//         <div className="chatbot-input">
//           <textarea
//             value={inputText}
//             onChange={(e) => setInputText(e.target.value)}
//             onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
//             placeholder="Ask about electricity usage..."
//             disabled={isLoading}
//           />
//           <button 
//             onClick={handleSendMessage} 
//             disabled={!inputText.trim() || isLoading}
//             className={isLoading ? 'loading' : ''}
//           >
//             {isLoading ? '...' : 'Send'}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ChatbotDialog;