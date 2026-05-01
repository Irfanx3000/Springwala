const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.html')) {
            results.push(file);
        }
    });
    return results;
}

const htmlFiles = walk(process.cwd());
htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Determine relative path to products/bulk-upload.html
    const relToRoot = path.relative(path.dirname(file), process.cwd());
    let bulkUploadPath = path.posix.join(relToRoot.replace(/\\/g, '/'), 'products/bulk-upload.html');
    if (bulkUploadPath.startsWith('./')) bulkUploadPath = bulkUploadPath.slice(2);
    if (!bulkUploadPath) bulkUploadPath = 'products/bulk-upload.html';

    // Regex handles newlines
    const regex = /<a href="#"([^>]*?)>\s*Bulk\s*Upload\s*<\/a>/gs;
    const newContent = content.replace(regex, `<a href="${bulkUploadPath}"$1>Bulk Upload</a>`);
    
    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Fixed ' + file);
    }
});
console.log('Done mapping Bulk Upload UI links');
