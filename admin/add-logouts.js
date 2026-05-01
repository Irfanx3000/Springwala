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

const logoutHTML = `
            <div class="mt-8 mb-2 w-full h-[1px] bg-black/15"></div>

            <button onclick="Auth.logout()" class="sidebar-item flex items-center px-[10px] py-[10px] gap-[15px] w-full group hover:bg-red-50 transition cursor-pointer">
                <svg class="w-6 h-6 shrink-0 text-[#BE2229]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                <span class="font-['Poppins'] text-[19px] leading-[28px] text-[#BE2229] font-medium">Logout</span>
            </button>
        </nav>`;

htmlFiles.forEach(file => {
    // Skip login
    if (file.includes('login.html')) return;
    
    let content = fs.readFileSync(file, 'utf8');
    
    // Skip if already has Auth.logout in the nav
    if (content.includes('Auth.logout()') && file.includes('settings.html')) return;
    if (content.includes('Auth.logout()')) {
       // but maybe it has it somewhere else? I am assuming if Auth.logout() exists in html, it's the button
    }
    
    // Check if it has </nav>
    if (content.includes('</nav>')) {
        if (!content.includes('Auth.logout()')) {
            const newContent = content.replace(/<\/nav>/, logoutHTML);
            if (content !== newContent) {
                fs.writeFileSync(file, newContent, 'utf8');
                console.log('Added logic to ' + file);
            }
        }
    }
});
console.log('Done appending to sidebars');
