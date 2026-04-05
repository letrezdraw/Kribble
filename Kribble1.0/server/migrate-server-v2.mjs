import fs from 'fs';
import path from 'path';

const SRC_DIR = 'd:/Files/Save/Git/Repos/Kribble/Kribble2.0/Kribble-Server/src';
const DEST_DIR = 'd:/Files/Save/Git/Repos/Kribble/Kribble1.0/server/src/k2';

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    
    for (const item of fs.readdirSync(src)) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        
        if (fs.lstatSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else if (srcPath.endsWith('.ts') || srcPath.endsWith('.json')) {
            let content = fs.readFileSync(srcPath, 'utf-8');
            
            if (srcPath.endsWith('.ts')) {
                // Calculate relative path for @/
                const rel = path.relative(path.dirname(destPath), DEST_DIR);
                const relativeRoot = rel === '' ? '.' : rel.replace(/\\/g, '/');
                
                // Replace @/ with relativeRoot/ and append .js
                content = content.replace(/(?:import|export)\s+[\s\S]*?\s+from\s+['"]@\/(.*?)['"]/g, (match, impPath) => {
                    return match.replace(`@/${impPath}`, `${relativeRoot}/${impPath}.js`);
                });

                // For relative imports, append .js if missing
                content = content.replace(/(?:import|export)\s+[\s\S]*?\s+from\s+['"](\.\/|\.\.\/)(.*?)['"]/g, (match, prefix, impPath) => {
                    if (impPath.endsWith('.js') || impPath.endsWith('.json')) {
                        return match;
                    }
                    return match.replace(`${prefix}${impPath}`, `${prefix}${impPath}.js`);
                });
                
                // Also fix imports like `import '@/something'`
                content = content.replace(/import\s+['"]@\/(.*?)['"]/g, (match, impPath) => {
                    return `import '${relativeRoot}/${impPath}.js'`;
                });
            }
            
            fs.writeFileSync(destPath, content);
        }
    }
}

// Copy the relevant directories
['constants', 'models', 'services', 'types', 'utils', 'controllers'].forEach(dir => {
    const src = path.join(SRC_DIR, dir);
    if (fs.existsSync(src)) {
        copyDir(src, path.join(DEST_DIR, dir));
    }
});

console.log('Migration complete with multiline regex fixed.');
