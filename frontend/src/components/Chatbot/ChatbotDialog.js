import React, { useState, useRef, useEffect } from 'react';
import './ChatbotDialog.css';

const ChatbotDialog = ({ onClose, theme = 'light' }) => {
  // State declarations
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [
      { 
        sender: 'bot', 
        text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for 2023-08-01'\n• 'Compare Building 121 with 125 on 2024-08-01'\n• 'List available buildings'"
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState('idle');
  const [apiEndpoint, setApiEndpoint] = useState('http://localhost:8080/completion');
  const [availableData, setAvailableData] = useState({});
  const [buildingOptions, setBuildingOptions] = useState([]);
  // Modified conversation context to store multiple interactions
  const [conversationContext, setConversationContext] = useState({
    interactions: [], // Array to store all relevant data queries and responses
    lastQuery: null,
    lastDataType: null, // 'single', 'comparison', null
    lastBuildings: [], // Store buildings involved in last query
    lastDate: null,
    recentData: null // Store recent data shown to user
  });
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
        text: "I'll help analyze your electricity consumption. Try:\n• 'Show Building 110 usage for 2023-08-01'\n• 'Compare Building 121 with 125 on 2024-08-01'\n• 'List available buildings'"
      }
    ]);
    // Clear all conversation context
    setConversationContext({
      interactions: [],
      lastQuery: null,
      lastDataType: null,
      lastBuildings: [],
      lastDate: null,
      recentData: null
    });
  };

  // Helper function to parse date from user input
  const parseDate = (prompt) => {
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
    
    return date;
  };

  // Helper function to find building from input
  const findBuilding = (buildingIdent, buildingOptions) => {
    if (!buildingIdent) return null;
    
    return buildingOptions.find(b => {
      // Remove non-alphanumeric characters for comparison
      const cleanOption = b.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const cleanInput = buildingIdent.replace(/[^a-z0-9]/gi, '').toLowerCase();
      return cleanOption.includes(cleanInput);
    });
  };

  // Helper function to fetch building data
  const fetchBuildingData = async (building, date) => {
    // Format date for API
    const apiMonth = date.getMonth() + 1;
    const apiDay = date.getDate();
    const apiYear = date.getFullYear();

    // Fetch consumption data
    const consumptionResponse = await fetch(
      `http://127.0.0.1:5000/fetch-data/${apiYear}/${apiMonth}/${apiDay}/${encodeURIComponent(building)}`
    );
    
    if (!consumptionResponse.ok) {
      throw new Error(`No data available for ${building} on ${date.toDateString()}`);
    }
    
    const consumptionData = await consumptionResponse.json();

    // Fetch stats data
    let statsData = null;
    try {
      const statsResponse = await fetch(
        `http://127.0.0.1:5000/stats/${apiYear}/${apiMonth}/${encodeURIComponent(building)}`
      );
      if (statsResponse.ok) {
        statsData = await statsResponse.json();
      }
    } catch (statsError) {
      console.warn('Could not fetch stats:', statsError);
    }

    return {
      building,
      date: date.toISOString(),
      formattedDate: date.toDateString(),
      consumption: consumptionData.consumption,
      stats: statsData
    };
  };

  // Function to check if input is a follow-up question
  const isFollowUpQuestion = (prompt) => {
    // If there's no previous context, it can't be a follow-up
    if (conversationContext.interactions.length === 0) return false;
    
    // Check if the prompt contains any direct data query indicators
    const directQueryIndicators = [
      /\bshow\s+building\s*\d+/i,
      /\bcompare\s+building\s*\d+/i,
      /\blist\s+available\s+buildings/i,
      /\bbuilding\s*\d+\s+usage/i,
      /\bbuilding\s*\d+\s+consumption/i,
      /\belectricity\s+usage\s+for\s+building\s*\d+/i,
      /\bon\s+\d{4}-\d{2}-\d{2}/i,
      /\bfor\s+\d{4}-\d{2}-\d{2}/i,
      /\b\d{2}\/\d{2}\/\d{4}\b/i
    ];
    
    // If the prompt matches any direct query pattern, it's not a follow-up
    for (const pattern of directQueryIndicators) {
      if (pattern.test(prompt)) return false;
    }
    
    // Check for follow-up indicators
    const followUpIndicators = [
      /\bwhich\s+(?:one|building)\s+(?:is|has|was)\s+(?:more|better|higher|lower|worse)\b/i,
      /\bwhat\s+(?:about|is|was)\s+the\s+(?:difference|comparison|ratio|percentage)\b/i,
      /\bwhy\s+(?:is|was|might|could)\s+it\b/i,
      /\bcan\s+you\s+(?:explain|elaborate|clarify)\b/i,
      /\bhow\s+(?:does|did|would|much|many)\b/i,
      /\bis\s+that\s+(?:normal|typical|unusual|common)\b/i,
      /\bwhat\s+(?:does|did|would|is|are|were)\s+this\s+mean\b/i,
      /\btell\s+me\s+more\b/i,
      /\bwhen\s+(?:was|is|did|would)\s+the\s+/i,
      /\b(?:any|more)\s+(?:insights|details|information)\b/i,
      /\bhow\s+efficient\b/i,
      /\bwhich\s+day\b/i,
      /\bcompared\s+to\b/i
    ];
    
    // If the prompt matches any follow-up pattern, it's likely a follow-up
    for (const pattern of followUpIndicators) {
      if (pattern.test(prompt)) return true;
    }
    
    // If a building is mentioned that's in our context, it might be a follow-up
    const buildingMentions = prompt.match(/\bbuilding\s*(\d+)\b/gi);
    if (buildingMentions) {
      const mentionedBuildings = buildingMentions.map(m => {
        const num = m.match(/\d+/);
        return num ? `Building ${num[0]}` : null;
      }).filter(Boolean);
      
      // Check if any mentioned building is in our context
      const contextBuildings = new Set();
      conversationContext.interactions.forEach(interaction => {
        if (interaction.buildings) {
          interaction.buildings.forEach(b => contextBuildings.add(b));
        }
      });
      
      const buildingInContext = mentionedBuildings.some(b => contextBuildings.has(b));
      if (buildingInContext) return true;
    }
    
    // If we've gotten this far, we'll assume it's a follow-up if it's a short question
    // This helps capture simple follow-ups like "Why?" or "How come?"
    const words = prompt.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 5) return true;
    
    // Default to not a follow-up
    return false;
  };

  const handleDirectQuery = async (prompt) => {
    // 1. List buildings command
    if (prompt.toLowerCase().includes('list available buildings') || 
        prompt.toLowerCase().includes('what buildings are available')) {
      if (buildingOptions.length === 0) {
        return "No building data available. Please try again later.";
      }
      // Store interaction in context
      const listInteraction = {
        type: 'list',
        timestamp: new Date().toISOString(),
        query: prompt,
        buildings: [],
        data: buildingOptions
      };
      
      // Update context
      setConversationContext(prev => ({
        ...prev,
        interactions: [...prev.interactions, listInteraction],
        lastQuery: prompt,
        lastDataType: 'list',
        lastBuildings: [],
        lastDate: null,
        recentData: buildingOptions
      }));
      
      return `Available buildings:\n${buildingOptions.map(b => `• ${b}`).join('\n')}`;
    }
    
    // 2. Check if this is a comparison query
    const compareRegex = /compare\s+(?:building\s*)?(\d+|[a-z]+)\s+(?:with|to|and)\s+(?:building\s*)?(\d+|[a-z]+)/i;
    const compareMatch = prompt.match(compareRegex);
    
    if (compareMatch) {
      // This is a comparison query
      const building1Ident = compareMatch[1];
      const building2Ident = compareMatch[2];
      
      // Find the actual building names
      const building1 = findBuilding(building1Ident, buildingOptions);
      const building2 = findBuilding(building2Ident, buildingOptions);
      
      // Validate buildings
      if (!building1) {
        return `Building "${building1Ident}" not found. Available buildings: ${
          buildingOptions.slice(0, 5).join(', ')}${buildingOptions.length > 5 ? '...' : ''}`;
      }
      
      if (!building2) {
        return `Building "${building2Ident}" not found. Available buildings: ${
          buildingOptions.slice(0, 5).join(', ')}${buildingOptions.length > 5 ? '...' : ''}`;
      }
      
      // Parse date (or use today if not specified)
      const date = parseDate(prompt);
      
      if (isNaN(date.getTime())) {
        return "⚠️ Invalid date format. Please use YYYY-MM-DD or MM/DD/YYYY";
      }
      
      // Check for future dates
      if (date > new Date()) {
        return "⚠️ Future dates aren't available. Please select a date up to today.";
      }
      
      try {
        // Fetch data for both buildings
        const building1Data = await fetchBuildingData(building1, date);
        const building2Data = await fetchBuildingData(building2, date);
        
        // Format basic comparison response
        const basicResponse = `
Comparison for ${date.toDateString()}:

Building: ${building1}
Consumption: ${building1Data.consumption} kWh
${building1Data.stats ? `
Monthly Statistics:
- Average: ${building1Data.stats.mean.toFixed(2)} kWh
- Peak: ${building1Data.stats.highest.toFixed(2)} kWh
- Lowest: ${building1Data.stats.lowest.toFixed(2)} kWh
` : ''}

Building: ${building2}
Consumption: ${building2Data.consumption} kWh
${building2Data.stats ? `
Monthly Statistics:
- Average: ${building2Data.stats.mean.toFixed(2)} kWh
- Peak: ${building2Data.stats.highest.toFixed(2)} kWh
- Lowest: ${building2Data.stats.lowest.toFixed(2)} kWh
` : ''}`.trim();

        // Prepare comparison data
        const comparisonData = {
          building1: building1Data,
          building2: building2Data,
          date: date.toISOString(),
          formattedDate: date.toDateString()
        };
        
        // Store interaction in context
        const comparisonInteraction = {
          type: 'comparison',
          timestamp: new Date().toISOString(),
          query: prompt,
          buildings: [building1, building2],
          date: date.toISOString(),
          data: comparisonData
        };
        
        // Update conversation context
        setConversationContext(prev => ({
          ...prev,
          interactions: [...prev.interactions, comparisonInteraction],
          lastQuery: prompt,
          lastDataType: 'comparison',
          lastBuildings: [building1, building2],
          lastDate: date,
          recentData: comparisonData
        }));
        
        // Prepare for LLM analysis
        return {
          analysisRequired: true,
          data: comparisonData,
          analysisPrompt: `Compare electricity usage between two buildings with these rules:
1. Compare ${building1}'s usage (${building1Data.consumption}kWh) with ${building2}'s usage (${building2Data.consumption}kWh)
2. Calculate percentage difference between the two buildings
3. Compare each building's usage to its monthly average (${building1Data.stats?.mean.toFixed(2)}kWh vs ${building2Data.stats?.mean.toFixed(2)}kWh)
4. Identify which building is more energy efficient relative to its average consumption
5. Format response with bullet points and clear sections
6. Dont include energy saving tips unless asked

Data:
${basicResponse}`
        };
      } catch (error) {
        console.error('Comparison error:', error);
        return `⚠️ Error: ${error.message}`;
      }
    }
  
    // 3. Extract building identifier for single building query
    let buildingIdent = null;
    const buildingMatch = prompt.match(/building\s*(\d+)/i) || 
                         prompt.match(/(\d+)(?=\s*(usage|consumption|data|for|on|from))/i) ||
                         prompt.match(/\b(HQ|Headquarters|Main)\b/i);
    if (buildingMatch) buildingIdent = buildingMatch[1];
  
    // 4. Find matching building (case insensitive)
    let building = findBuilding(buildingIdent, buildingOptions);
    
    if (!building && buildingIdent) {
      return `Building "${buildingIdent}" not found. Available buildings: ${
        buildingOptions.slice(0, 5).join(', ')}${buildingOptions.length > 5 ? '...' : ''}`;
    } else if (!building) {
      return null; // No building specified, might be a general question
    }
  
    // 5. Date parsing
    const date = parseDate(prompt);
    
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
    
    // 6. Check if query is for raw data or analysis
    const wantsAnalysis = prompt.toLowerCase().includes('analyze') || 
                         prompt.toLowerCase().includes('insight');
  
    try {
      // Fetch building data
      const buildingData = await fetchBuildingData(building, date);
  
      // 8. Format basic response
      const basicResponse = `
Building: ${building}
Date: ${date.toDateString()}
Consumption: ${buildingData.consumption} kWh
${buildingData.stats ? `
Monthly Statistics:
- Average: ${buildingData.stats.mean.toFixed(2)} kWh
- Peak: ${buildingData.stats.highest.toFixed(2)} kWh
- Lowest: ${buildingData.stats.lowest.toFixed(2)} kWh
` : ''}`.trim();

      // Store interaction in context
      const singleInteraction = {
        type: 'single',
        timestamp: new Date().toISOString(),
        query: prompt,
        buildings: [building],
        date: date.toISOString(),
        data: buildingData
      };

      // Update conversation context
      setConversationContext(prev => ({
        ...prev,
        interactions: [...prev.interactions, singleInteraction],
        lastQuery: prompt,
        lastDataType: 'single',
        lastBuildings: [building],
        lastDate: date,
        recentData: buildingData
      }));
  
      // 9. Return basic data or prepare for AI analysis
      if (!wantsAnalysis) {
        return basicResponse;
      }
  
      // 10. Prepare for LLM analysis
      return {
        analysisRequired: true,
        data: buildingData,
        analysisPrompt: `Analyze electricity usage with these rules:
1. Compare ${building}'s usage (${buildingData.consumption}kWh) to its monthly average (${buildingData.stats?.mean.toFixed(2)}kWh)
2. Highlight any anomalies (${buildingData.stats ? `current is ${((buildingData.consumption - buildingData.stats.mean)/buildingData.stats.mean * 100).toFixed(1)}% from average` : 'no stats available'})
3. Format response with bullet points

Data:
${basicResponse}`
      };
  
    } catch (error) {
      console.error('Query error:', error);
      return `⚠️ Error: ${error.message}`;
    }
  };

  // New improved function to handle follow-up questions using the entire conversation history
  const handleFollowUp = (prompt) => {
    if (conversationContext.interactions.length === 0) {
      return null;
    }

    // Get last 5 relevant interactions for context (or fewer if we don't have 5)
    const relevantInteractions = conversationContext.interactions
      .slice(-5)
      .filter(interaction => interaction.type !== 'general'); // Filter out general chit-chat

    // Begin building conversation context
    let contextDescription = 'You are analyzing electricity consumption data. Here is the relevant context from our conversation:\n\n';
    
    // Add each interaction to the context
    relevantInteractions.forEach((interaction, index) => {
      contextDescription += `--- Interaction ${index + 1} ---\n`;
      
      if (interaction.type === 'comparison') {
        const data = interaction.data;
        contextDescription += `Query: "${interaction.query}"\n`;
        contextDescription += `Date: ${new Date(data.date).toDateString()}\n`;
        contextDescription += `Building: ${data.building1.building}\n`;
        contextDescription += `Consumption: ${data.building1.consumption} kWh\n`;
        if (data.building1.stats) {
          contextDescription += `Monthly average: ${data.building1.stats.mean.toFixed(2)} kWh\n`;
        }
        
        contextDescription += `\nBuilding: ${data.building2.building}\n`;
        contextDescription += `Consumption: ${data.building2.consumption} kWh\n`;
        if (data.building2.stats) {
          contextDescription += `Monthly average: ${data.building2.stats.mean.toFixed(2)} kWh\n`;
        }
      } 
      else if (interaction.type === 'single') {
        const data = interaction.data;
        contextDescription += `Query: "${interaction.query}"\n`;
        contextDescription += `Building: ${data.building}\n`;
        contextDescription += `Date: ${new Date(data.date).toDateString()}\n`;
        contextDescription += `Consumption: ${data.consumption} kWh\n`;
        if (data.stats) {
          contextDescription += `Monthly average: ${data.stats.mean.toFixed(2)} kWh\n`;
          contextDescription += `Peak: ${data.stats.highest.toFixed(2)} kWh\n`;
          contextDescription += `Lowest: ${data.stats.lowest.toFixed(2)} kWh\n`;
        }
      }
      else if (interaction.type === 'list') {
        contextDescription += `Query: "${interaction.query}"\n`;
        contextDescription += `Available buildings: ${interaction.data.slice(0, 10).join(', ')}`;
        if (interaction.data.length > 10) {
          contextDescription += ` and ${interaction.data.length - 10} more`;
        }
        contextDescription += '\n';
      }
      
      contextDescription += '\n';
    });

    // Find any building mentions in the user's question
    const buildingMentions = prompt.match(/\bbuilding\s*(\d+)\b/gi);
    const mentionedBuildings = [];
    
    if (buildingMentions) {
      buildingMentions.forEach(mention => {
        const num = mention.match(/\d+/);
        if (num) {
          const buildingName = `Building ${num[0]}`;
          // Check if this building exists in our options
          const validBuilding = findBuilding(num[0], buildingOptions);
          if (validBuilding) {
            mentionedBuildings.push(validBuilding);
          }
        }
      });
    }
    
    // If specific buildings are mentioned in the question, prioritize data for those buildings
    if (mentionedBuildings.length > 0) {
      contextDescription += "The user's question mentions these specific buildings:\n";
      mentionedBuildings.forEach(building => {
        contextDescription += `- ${building}\n`;
        
        // Find the most recent data for this building
        const relevantData = conversationContext.interactions
          .filter(interaction => 
            (interaction.type === 'single' && interaction.buildings.includes(building)) ||
            (interaction.type === 'comparison' && 
              (interaction.data.building1.building === building || 
               interaction.data.building2.building === building))
          )
          .pop(); // Get the most recent one
          
        if (relevantData) {
          if (relevantData.type === 'single') {
            contextDescription += `  Latest data (${new Date(relevantData.data.date).toDateString()}): ${relevantData.data.consumption} kWh\n`;
            if (relevantData.data.stats) {
              contextDescription += `  Monthly average: ${relevantData.data.stats.mean.toFixed(2)} kWh\n`;
            }
          } else if (relevantData.type === 'comparison') {
            // Determine which building in the comparison matches
            if (relevantData.data.building1.building === building) {
              contextDescription += `  Latest data (${new Date(relevantData.data.date).toDateString()}): ${relevantData.data.building1.consumption} kWh\n`;
              if (relevantData.data.building1.stats) {
                contextDescription += `  Monthly average: ${relevantData.data.building1.stats.mean.toFixed(2)} kWh\n`;
              }
            } else {
              contextDescription += `  Latest data (${new Date(relevantData.data.date).toDateString()}): ${relevantData.data.building2.consumption} kWh\n`;
              if (relevantData.data.building2.stats) {
                contextDescription += `  Monthly average: ${relevantData.data.building2.stats.mean.toFixed(2)} kWh\n`;
              }
            }
          }
        }
      });
      contextDescription += '\n';
    }
    
    // Complete the context and generate the analysis prompt
    const analysisPrompt = `
${contextDescription}

Based on the above context from our conversation, please answer the following follow-up question:
"${prompt}"

Provide a clear, concise answer based only on the data provided. If the question refers to something not covered in the context, mention that you don't have that specific information. Be brief and to the point.`;
    
    return {
      analysisRequired: true,
      data: relevantInteractions.length > 0 ? relevantInteractions[relevantInteractions.length - 1].data : null,
      analysisPrompt: analysisPrompt
    };
  };

  const fetchLlamaResponse = async (prompt) => {
    setIsLoading(true);
    setModelStatus('loading');
    
    try {
      setMessages(prev => [...prev, { sender: 'user', text: prompt }]);
      
      // Check if this is a follow-up question about previous data
      const isFollowUp = isFollowUpQuestion(prompt);
      let directResponse = null;
      
      if (isFollowUp) {
        console.log("Detected follow-up question, using context from conversation history");
        directResponse = handleFollowUp(prompt);
      } else {
        // Handle as a new direct data query
        directResponse = await handleDirectQuery(prompt);
      }
      
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
          
          // Store this interaction in context
          const generalInteraction = {
            type: 'general',
            timestamp: new Date().toISOString(),
            query: prompt,
            isFollowUp: isFollowUp
          };
          
          setConversationContext(prev => ({
            ...prev,
            interactions: [...prev.interactions, generalInteraction]
          }));
          
          // Check if this is a comparison analysis
          if (!isFollowUp && conversationContext.lastDataType === 'comparison' && directResponse.data.building1 && directResponse.data.building2) {
            setMessages(prev => [
              ...prev,
              { 
                sender: 'bot', 
                text: `🔍 Comparison between ${directResponse.data.building1.building} and ${directResponse.data.building2.building} on ${new Date(directResponse.data.building1.date).toDateString()}:\n\n${analysis}`
              }
            ]);
          } else if (!isFollowUp && conversationContext.lastDataType === 'single') {
            setMessages(prev => [
              ...prev,
              { 
                sender: 'bot', 
                text: `🔍 Analysis for ${directResponse.data.building} on ${new Date(directResponse.data.date).toDateString()}:\n\n${analysis}`
              }
            ]);
          } else {
            // For follow-up questions, just show the analysis without prefixes
            setMessages(prev => [
              ...prev,
              { sender: 'bot', text: analysis }
            ]);
          }
        } else {
          // Store this interaction in context
          const generalInteraction = {
            type: 'general',
            timestamp: new Date().toISOString(),
            query: prompt,
            response: directResponse,
            isFollowUp: false
          };
          
          setConversationContext(prev => ({
            ...prev,
            interactions: [...prev.interactions, generalInteraction]
          }));
          
          setMessages(prev => [...prev, { sender: 'bot', text: directResponse }]);
        }
        setModelStatus('idle');
        return;
      }

      // If we get here, handle as a general query
      // First, collect information about the conversation context to provide to the LLM
      const contextSummary = conversationContext.interactions.length > 0 
      ? `You are an energy consumption assistant. You've been discussing electricity usage data. ${
          conversationContext.lastBuildings.length > 0 
            ? `Most recently discussing ${conversationContext.lastBuildings.join(' and ')}` 
            : ''
        }${
          conversationContext.lastDate 
            ? ` for ${conversationContext.lastDate.toDateString()}` 
            : ''
        }.` 
      : `You are an energy consumption assistant for a building management system.`;

      // Create a general response prompt
      const generalPrompt = `${contextSummary}

      User query: "${prompt}"

      Respond conversationally and helpfully. If the user is asking about specific building data that you don't have, suggest they try commands like:
      - "Show Building 110 usage for 2023-08-01" 
      - "Compare Building 121 with Building 125 on 2024-08-01"
      - "List available buildings"

      Only include these suggestions if relevant to their question.`;

      try {
      // Get response from LLM
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: generalPrompt,
          temperature: 0.7,
          max_tokens: 300
        })
      });

      const data = await response.json();
      const llmResponse = data.content.trim();

      // Store this general interaction in context
      const generalInteraction = {
        type: 'general',
        timestamp: new Date().toISOString(),
        query: prompt,
        response: llmResponse
      };

      setConversationContext(prev => ({
        ...prev,
        interactions: [...prev.interactions, generalInteraction]
      }));

      setMessages(prev => [...prev, { sender: 'bot', text: llmResponse }]);
      } catch (error) {
      console.error('Error getting LLM response:', error);
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: "I'm sorry, I encountered an error processing your request. Please try again." 
      }]);
      }
      } finally {
      setIsLoading(false);
      setModelStatus('idle');
      }
      };

      const handleInputChange = (e) => {
      setInputText(e.target.value);
      };

      const handleSendMessage = async () => {
      if (inputText.trim() === '') return;

      const userMessage = inputText.trim();
      setInputText('');

      await fetchLlamaResponse(userMessage);
      };

      const handleKeyPress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
      };

      return (
      <div className={`chatbot-dialog ${theme === 'dark' ? 'dark-theme' : ''}`}>
        <div className="chatbot-header">
          <h2>Energy Consumption Assistant</h2>
          <div className="chatbot-controls">
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme} 
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button 
              className="clear-chat-btn" 
              onClick={clearConversation}
              title="Clear conversation"
            >
              🗑️
            </button>
            <button 
              className="close-btn" 
              onClick={onClose}
              title="Close chatbot"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
            >
              <div className="message-content">
                {message.text.split('\n').map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
          
          {isLoading && (
            <div className="bot-message">
              <div className="message-content">
                <p className="typing-indicator">
                  <span className="spinner"></span>
                  Analyzing your request...
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="chat-input-container">
          <textarea
            className="chat-input"
            value={inputText}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Ask about building energy usage..."
            rows={1}
          />
          <button 
            className="send-btn" 
            onClick={handleSendMessage}
            disabled={isLoading || inputText.trim() === ''}
          >
            📤
          </button>
        </div>

        <div className="chat-footer">
          <span className="info-text">
            Try: "Show Building 110 usage for today" or "Compare Building 121 with 125"
          </span>
        </div>
      </div>
      );
      };

      // Add PropTypes for TypeScript-like type checking
      ChatbotDialog.propTypes = {
      onClose: React.PropTypes.func.isRequired,
      theme: React.PropTypes.oneOf(['light', 'dark'])
      };

      export default ChatbotDialog;