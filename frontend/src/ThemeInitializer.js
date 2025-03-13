import { useEffect } from 'react';

const ThemeInitializer = () => {
  useEffect(() => {
    // Get theme from localStorage or use default
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.setAttribute('data-theme', savedTheme);
    
    // Apply class-based approach as well
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    
    // Force a redraw
    document.body.style.backgroundColor = '';
  }, []);
  
  return null; // This component doesn't render anything
};

export default ThemeInitializer;