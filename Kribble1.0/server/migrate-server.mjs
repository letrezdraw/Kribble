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
            
            // If it's a TS file, fix the imports
            if (srcPath.endsWith('.ts')) {
                // Fix @/ imports to relative imports
                // Since DEST_DIR is src/k2, @/ maps to src/k2/
                const depth = path.relative(path.dirname(destPath), DEST_DIR).split(path.sep).length;
                const relativeRoot = depth === 1 && path.relative(path.dirname(destPath), DEST_DIR) === '' ? '.' : new Array(depth).fill('..').join('/');
                
                content = content.replace(/(import|export) (.*?) from ['"]@\/(.*?)['"]/g, (match, type, imports, impPath) => {
                    return `${type} ${imports} from '${relativeRoot}/${impPath}.js'`;
                });

                // Fix relative imports (./ or ../) to include .js
                content = content.replace(/(import|export) (.*?) from ['"](\.\/|\.\.\/)(.*?)['"]/g, (match, type, imports, prefix, impPath) => {
                    // Don't append .js if it already has .js or .json
                    if (impPath.endsWith('.js') || impPath.endsWith('.json')) {
                        return match;
                    }
                    return `${type} ${imports} from '${prefix}${impPath}.js'`;
                });
            }
            
            fs.writeFileSync(destPath, content);
        }
    }
}

// Copy the relevant directories
['constants', 'models', 'services', 'types', 'utils'].forEach(dir => {
    copyDir(path.join(SRC_DIR, dir), path.join(DEST_DIR, dir));
});

console.log('Done migrating Kribble 2.0 server code.');
