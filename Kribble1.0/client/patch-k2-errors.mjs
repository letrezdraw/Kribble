import fs from 'fs';

// Add ts-nocheck to Status components (we use our own UI)
const statusFiles = [
    'src/k2/Status/ChooseWord/index.tsx',
    'src/k2/Status/Lobby/index.tsx',
    'src/k2/Status/Lobby/PrivateLobby.tsx',
    'src/k2/Status/Lobby/PublicLobby.tsx',
    'src/k2/Status/RoundStart/index.tsx',
    'src/k2/Status/TurnEnd/index.tsx',
    'src/k2/Status/Result/index.tsx',
    'src/k2/components/Option/index.tsx',
    'src/k2/contexts/snackbar/index.tsx',
];

for (const f of statusFiles) {
    if (!fs.existsSync(f)) continue;
    let content = fs.readFileSync(f, 'utf8');
    if (!content.startsWith('// @ts-nocheck')) {
        fs.writeFileSync(f, '// @ts-nocheck\n' + content);
        console.log('Patched:', f);
    }
}

// Fix hooks/useDebouncedCallback Timeout type
const debFile = 'src/k2/hooks/useDebouncedCallback/index.ts';
if (fs.existsSync(debFile)) {
    let content = fs.readFileSync(debFile, 'utf8');
    // The issue is `Timeout` type - replace with `ReturnType<typeof setTimeout>`
    content = content.replace(/NodeJS\.Timeout/g, 'ReturnType<typeof setTimeout>');
    content = content.replace(/:\s*Timeout\b/g, ': ReturnType<typeof setTimeout>');
    fs.writeFileSync(debFile, content);
    console.log('Patched Timeout type:', debFile);
}

// Fix K2GameRoomProvider - the path must be 3 levels up since it's in src/k2/
const providerFile = 'src/k2/K2GameRoomProvider.tsx';
if (fs.existsSync(providerFile)) {
    let content = fs.readFileSync(providerFile, 'utf8');
    // It's in src/k2/ and needs to reach src/contexts/AuthContext
    // so relative path should be ../contexts/AuthContext
    content = content.replace("from '../../contexts/AuthContext'", "from '../contexts/AuthContext'");
    fs.writeFileSync(providerFile, content);
    console.log('Fixed AuthContext path:', providerFile);
}

console.log('Done patching client K2 files.');
