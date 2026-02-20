// Simple profanity filter for chat and usernames

const PROFANITY_LIST = [
  // Common profanity (partial list - expand as needed)
  'badword1', 'badword2', 'badword3',
  // Add more words as needed
];

const PARTIAL_MATCHES = [
  // Patterns that should be caught
  /bad\w+/gi,
];

export function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check exact matches
  for (const word of PROFANITY_LIST) {
    if (lowerText.includes(word.toLowerCase())) {
      return true;
    }
  }
  
  // Check pattern matches
  for (const pattern of PARTIAL_MATCHES) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

export function censorProfanity(text: string): string {
  let censored = text;
  
  // Censor exact matches
  for (const word of PROFANITY_LIST) {
    const regex = new RegExp(word, 'gi');
    censored = censored.replace(regex, '*'.repeat(word.length));
  }
  
  return censored;
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.trim().length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  
  if (username.length > 20) {
    return { valid: false, error: 'Username must be less than 20 characters' };
  }
  
  if (containsProfanity(username)) {
    return { valid: false, error: 'Username contains inappropriate language' };
  }
  
  // Only allow alphanumeric, spaces, and common symbols
  if (!/^[\w\s\-_\.]+$/.test(username)) {
    return { valid: false, error: 'Username contains invalid characters' };
  }
  
  return { valid: true };
}

export function validateMessage(message: string): { valid: boolean; censored?: string; error?: string } {
  if (!message || message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (message.length > 500) {
    return { valid: false, error: 'Message too long (max 500 characters)' };
  }
  
  // Censor but still allow the message
  const censored = censorProfanity(message);
  
  return { valid: true, censored };
}

