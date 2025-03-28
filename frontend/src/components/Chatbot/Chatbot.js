import React, { useState, useEffect } from 'react';
import ChatbotButton from './ChatbotButton';
import ChatbotDialog from './ChatbotDialog';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  // Get the current theme when the component mounts
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // Listen for theme changes
    const handleThemeChange = () => {
      const currentTheme = localStorage.getItem('theme') || 'light';
      setTheme(currentTheme);
    };

    // Set up an observer to watch for attributes changes on the document
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' && 
          mutation.attributeName === 'data-theme'
        ) {
          handleThemeChange();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    // Clean up the observer
    return () => {
      observer.disconnect();
    };
  }, []);

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  const closeChatbot = () => {
    setIsOpen(false);
  };

  return (
    <>
      <ChatbotButton onClick={toggleChatbot} />
      {isOpen && <ChatbotDialog onClose={closeChatbot} theme={theme} />}
    </>
  );
};

export default Chatbot; 