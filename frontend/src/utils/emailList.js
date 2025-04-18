const EMAIL_LIST_KEY = 'emailList';

// Retrieve the email list from localStorage
export const getEmailList = () => {
  const savedEmails = localStorage.getItem(EMAIL_LIST_KEY);
  return savedEmails ? JSON.parse(savedEmails) : [];
};

// Add an email to the global list
export const addEmailToList = (email) => {
  const emailList = getEmailList();
  if (!emailList.includes(email)) {
    emailList.push(email);
    localStorage.setItem(EMAIL_LIST_KEY, JSON.stringify(emailList));
  }
};

// Remove an email from the global list
export const removeEmailFromList = (emailToRemove) => {
  const emailList = getEmailList().filter(email => email !== emailToRemove);
  localStorage.setItem(EMAIL_LIST_KEY, JSON.stringify(emailList));
};
