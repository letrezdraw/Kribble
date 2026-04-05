import fs from 'fs';
import path from 'path';

const K2_DIR = 'd:/Files/Save/Git/Repos/Kribble/Kribble1.0/client/src/k2';

function walk(dir, cb) {
    for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.lstatSync(full).isDirectory()) walk(full, cb);
        else cb(full);
    }
}

walk(K2_DIR, (file) => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;
    let content = fs.readFileSync(file, 'utf-8');
    let changed = false;

    // Replace CRA env API with Vite's import.meta.env
    if (content.includes('process.env.NODE_ENV')) {
        content = content.replace(/process\.env\.NODE_ENV/g, 'import.meta.env.MODE');
        changed = true;
    }
    if (content.includes('process.env.REACT_APP_DOODLE_SERVER_URL')) {
        content = content.replace(/process\.env\.REACT_APP_DOODLE_SERVER_URL/g, 'import.meta.env.VITE_K2_SOCKET_URL');
        changed = true;
    }
    if (content.includes('process.env.REACT_APP_SOCKET_RECONNECT_ATTEMPTS')) {
        content = content.replace(/process\.env\.REACT_APP_SOCKET_RECONNECT_ATTEMPTS/g, 'import.meta.env.VITE_SOCKET_RECONNECT_ATTEMPTS');
        changed = true;
    }
    if (content.includes('process.env.REACT_APP_SOCKET_ACK_TIMEOUT_MS')) {
        content = content.replace(/process\.env\.REACT_APP_SOCKET_ACK_TIMEOUT_MS/g, 'import.meta.env.VITE_SOCKET_ACK_TIMEOUT_MS');
        changed = true;
    }

    // Fix worker URL: CRA uses __webpack relative, Vite needs new URL(...)
    // The fill worker import path already uses import.meta.url so it's fine

    // Fix the DEFAULT_SERVER_ORIGIN for dev - K1.0 server runs on 3001
    if (file.includes('contexts/socket/index') && content.includes("'http://localhost:5000'")) {
        content = content.replace("'http://localhost:5000'", "'http://localhost:3001'");
        changed = true;
    }

    if (changed) fs.writeFileSync(file, content);
});

console.log('K2 client env vars patched for Vite.');
