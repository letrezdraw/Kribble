#!/usr/bin/env node

/**
 * Kribble Local Environment Setup Script
 * 
 * This script helps configure the local development environment
 * by creating the necessary .env files from templates.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

async function main() {
  console.log('🎨 Kribble Local Development Setup\n');
  console.log('This script will help you configure your local environment.\n');

  // Check if .env files already exist
  const rootEnv = path.join(process.cwd(), '.env');
  const clientEnvLocal = path.join(process.cwd(), 'client', '.env.local');
  
  if (fs.existsSync(rootEnv)) {
    console.log('⚠️  Root .env file already exists. Skipping server configuration.');
  } else {
    console.log('📋 Server Configuration\n');
    
    const serverPort = await question('Server port (default: 3001): ') || '3001';
    const jwtSecret = await question('JWT Secret (press Enter for random): ') || generateRandomSecret();
    
    const envContent = `# Kribble Server Environment
NODE_ENV=development
PORT=${serverPort}
JWT_SECRET=${jwtSecret}
# DATABASE_URL=postgresql://user:pass@localhost:5432/kribble
`;
    
    fs.writeFileSync(rootEnv, envContent);
    console.log('✅ Created .env file for server\n');
  }

  if (fs.existsSync(clientEnvLocal)) {
    console.log('⚠️  Client .env.local file already exists. Skipping client configuration.');
  } else {
    console.log('📋 Client Configuration\n');
    
    console.log('Choose your development setup:');
    console.log('1. Use Vite proxy (recommended) - Client and server on separate ports, API proxied automatically');
    console.log('2. Explicit URLs - Set specific URLs for API and WebSocket');
    
    const choice = await question('\nChoice (1 or 2, default: 1): ') || '1';
    
    let clientEnvContent = '';
    
    if (choice === '1') {
      clientEnvContent = `# Kribble Client - Local Development
# Using Vite proxy (recommended)
# Leave empty to use proxy configured in vite.config.ts
VITE_API_URL=
VITE_SOCKET_URL=
VITE_DEBUG=true
`;
      console.log('\n✅ Using Vite proxy configuration');
      console.log('   - Client will run on :5173');
      console.log('   - Server should run on :3001');
      console.log('   - API calls automatically proxied');
    } else {
      const apiUrl = await question('API URL (default: http://localhost:3001): ') || 'http://localhost:3001';
      const socketUrl = await question('Socket URL (default: http://localhost:3001): ') || 'http://localhost:3001';
      
      clientEnvContent = `# Kribble Client - Local Development
# Explicit URL configuration
VITE_API_URL=${apiUrl}
VITE_SOCKET_URL=${socketUrl}
VITE_DEBUG=true
`;
      console.log('\n✅ Using explicit URL configuration');
    }
    
    fs.writeFileSync(clientEnvLocal, clientEnvContent);
    console.log('✅ Created client/.env.local file\n');
  }

  console.log('🎉 Setup complete!\n');
  console.log('Next steps:');
  console.log('1. Start the server: cd server && npm run dev');
  console.log('2. Start the client: cd client && npm run dev');
  console.log('3. Open http://localhost:5173 in your browser\n');
  
  console.log('For more information, see:');
  console.log('- LOCAL_URL_CONFIGURATION.md');
  console.log('- LOCAL_DEVELOPMENT_GUIDE.md\n');

  rl.close();
}

function generateRandomSecret() {
  return require('crypto').randomBytes(32).toString('hex');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
