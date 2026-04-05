import fs from 'fs';
import path from 'path';

const K2_SRC = 'd:/Files/Save/Git/Repos/Kribble/Kribble2.0/Kribble-Client/src';
const K1_SRC = 'd:/Files/Save/Git/Repos/Kribble/Kribble1.0/client/src/k2';

function copyDir(src, dest, fixImports = true) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        if (fs.lstatSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath, fixImports);
        } else {
            let content = fs.readFileSync(srcPath, 'utf-8');
            if (fixImports && (srcPath.endsWith('.ts') || srcPath.endsWith('.tsx'))) {
                // Calculate depth to k2 root
                const rel = path.relative(path.dirname(destPath), K1_SRC);
                const rootPath = rel === '' ? '.' : rel.replace(/\\/g, '/');
                // Replace @/ imports with relative path to k2/
                content = content.replace(/from\s+['"]@\/(.*?)['"]/g, (_, imp) => `from '${rootPath}/${imp}'`);
                // Also require() style
                content = content.replace(/require\(['"]@\/(.*?)['"]\)/g, (_, imp) => `require('${rootPath}/${imp}')`);
            }
            fs.writeFileSync(destPath, content);
        }
    }
}

// Copy types
copyDir(path.join(K2_SRC, 'types'), path.join(K1_SRC, 'types'));
// Copy constants
copyDir(path.join(K2_SRC, 'constants'), path.join(K1_SRC, 'constants'));
// Copy utils
copyDir(path.join(K2_SRC, 'utils'), path.join(K1_SRC, 'utils'));
// Copy workers
copyDir(path.join(K2_SRC, 'workers'), path.join(K1_SRC, 'workers'));
// Copy hooks needed
copyDir(path.join(K2_SRC, 'hooks'), path.join(K1_SRC, 'hooks'));
// Copy contexts
copyDir(path.join(K2_SRC, 'contexts'), path.join(K1_SRC, 'contexts'));
// Copy Canvas component from routes/Game
copyDir(
    path.join(K2_SRC, 'routes/Game/components/Canvas'),
    path.join(K1_SRC, 'components/Canvas')
);
// Copy Option component (needed by Canvas toolbar)
copyDir(
    path.join(K2_SRC, 'routes/Game/components/Option'),
    path.join(K1_SRC, 'components/Option')
);
// Copy Status components
copyDir(
    path.join(K2_SRC, 'routes/Game/Status'),
    path.join(K1_SRC, 'Status')
);

console.log('Client files copied.');
