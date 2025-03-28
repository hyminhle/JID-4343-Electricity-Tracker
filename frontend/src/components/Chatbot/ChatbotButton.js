import React from 'react';
import './ChatbotButton.css';

const ChatbotButton = ({ onClick }) => {
  return (
    <div className="chatbot-button" onClick={onClick}>
      <div className="chatbot-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24px" height="24px">
          <path d="M0 0h24v24H0V0z" fill="none"/>
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
        </svg>
      </div>
    </div>
  );
};

export default ChatbotButton; 