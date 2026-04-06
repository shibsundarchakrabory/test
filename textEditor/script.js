/**
 * ViveView Text Editor - Core Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const docTitleInput = document.getElementById('docTitle');
    const wordCountSpan = document.getElementById('wordCount');
    const charCountSpan = document.getElementById('charCount');
    const readTimeSpan = document.getElementById('readTime');
    const lastSavedSpan = document.getElementById('lastSavedText');
    const toolbar = document.getElementById('mainToolbar');
    
    // Buttons and Inputs
    const toolBtns = document.querySelectorAll('.tool-btn[data-command]');
    const formatSelect = document.getElementById('formatBlock');
    const foreColorInput = document.getElementById('foreColor');
    const hiliteColorInput = document.getElementById('hiliteColor');
    const pageColorInput = document.getElementById('pageColor');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const saveBtn = document.getElementById('saveBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const focusModeBtn = document.getElementById('focusModeBtn');
    const themeBtns = document.querySelectorAll('.theme-btn');
    const linkBtn = document.getElementById('linkBtn');
    const imageBtn = document.getElementById('imageBtn');
    const clearBtn = document.getElementById('clearBtn');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebar = document.querySelector('.side-info');

    // 1. Initial Setup
    loadDocument();
    updateStats();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 2. Formatting Commands
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const command = btn.getAttribute('data-command');
            document.execCommand(command, false, null);
            editor.focus();
            updateToolbarState();
        });
    });

    formatSelect.addEventListener('change', () => {
        const value = formatSelect.value;
        document.execCommand('formatBlock', false, `<${value}>`);
        editor.focus();
    });

    foreColorInput.addEventListener('input', () => {
        document.execCommand('foreColor', false, foreColorInput.value);
    });

    hiliteColorInput.addEventListener('input', () => {
        document.execCommand('hiliteColor', false, hiliteColorInput.value);
    });

    pageColorInput.addEventListener('input', () => {
        editor.style.backgroundColor = pageColorInput.value;
        autoSave();
    });

    linkBtn.addEventListener('click', () => {
        const url = prompt('Enter the URL:', 'https://');
        if (url) {
            document.execCommand('createLink', false, url);
        }
    });

    imageBtn.addEventListener('click', () => {
        const url = prompt('Enter the image URL:', 'https://');
        if (url) {
            document.execCommand('insertImage', false, url);
        }
    });

    clearBtn.addEventListener('click', () => {
        document.execCommand('removeFormat', false, null);
    });

    undoBtn.addEventListener('click', () => {
        document.execCommand('undo', false, null);
        updateStats();
    });

    redoBtn.addEventListener('click', () => {
        document.execCommand('redo', false, null);
        updateStats();
    });

    // 3. Editor Interaction
    editor.addEventListener('input', () => {
        updateStats();
        autoSave();
    });

    editor.addEventListener('keydown', (e) => {
        // Tab support for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertHTML', false, '&#160;&#160;&#160;&#160;');
        }
        
        // Ctrl+S to save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveDocument();
        }
    });

    // 4. Statistics Logic
    function updateStats() {
        const text = editor.innerText.trim();
        const words = text ? text.split(/\s+/).length : 0;
        const chars = text.length;
        const readTime = Math.max(1, Math.ceil(words / 200));

        wordCountSpan.textContent = words;
        charCountSpan.textContent = chars;
        readTimeSpan.textContent = `${readTime} min`;
    }

    // 5. Persistence (Local Storage)
    function saveDocument() {
        const content = editor.innerHTML;
        const title = docTitleInput.value;
        const data = {
            title,
            content,
            pageColor: pageColorInput.value,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('viveview_editor_data', JSON.stringify(data));
        
        const now = new Date();
        lastSavedSpan.textContent = `Saved at ${now.toLocaleTimeString()}`;
        
        // Visual feedback
        saveBtn.classList.add('pulse');
        setTimeout(() => saveBtn.classList.remove('pulse'), 1000);
    }

    let saveTimeout;
    function autoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveDocument, 3000); // 3-second throttle
    }

    function loadDocument() {
        const savedData = localStorage.getItem('viveview_editor_data');
        if (savedData) {
            const data = JSON.parse(savedData);
            editor.innerHTML = data.content || '';
            docTitleInput.value = data.title || 'Untitled Document';
            const savedDate = new Date(data.timestamp);
            lastSavedSpan.textContent = `Last saved: ${savedDate.toLocaleTimeString()}`;
            
            if (data.pageColor) {
                editor.style.backgroundColor = data.pageColor;
                pageColorInput.value = data.pageColor;
            }
        }
    }

    // 6. Export Functionality
    downloadBtn.addEventListener('click', () => {
        const title = docTitleInput.value || 'document';
        const content = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; padding: 40px; max-width: 800px; margin: auto; }
        h1 { border-bottom: 1px solid #ccc; }
        blockquote { border-left: 4px solid #3b82f6; padding-left: 20px; font-style: italic; color: #666; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${editor.innerHTML}
</body>
</html>`;

        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.html`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // 7. Focus Mode (Zen Mode)
    focusModeBtn.addEventListener('click', () => {
        document.body.classList.toggle('focus-mode');
        const icon = focusModeBtn.querySelector('i');
        if (document.body.classList.contains('focus-mode')) {
            icon.setAttribute('data-lucide', 'minimize');
            focusModeBtn.querySelector('span').textContent = 'Exit Zen';
        } else {
            icon.setAttribute('data-lucide', 'maximize');
            focusModeBtn.querySelector('span').textContent = 'Zen';
        }
        lucide.createIcons();
    });

    // 8. Theme Switching
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            document.body.setAttribute('data-theme', theme);
            
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Persist theme
            localStorage.setItem('viveview_editor_theme', theme);
        });
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('viveview_editor_theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
        const activeThemeBtn = document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`);
        if (activeThemeBtn) {
            themeBtns.forEach(b => b.classList.remove('active'));
            activeThemeBtn.classList.add('active');
        }
    }

    // 9. Toolbar State Management (Active commands highlight)
    function updateToolbarState() {
        toolBtns.forEach(btn => {
            const command = btn.getAttribute('data-command');
            if (document.queryCommandState(command)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // 10. Sidebar Toggle
    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const icon = sidebarToggleBtn.querySelector('i');
        if (sidebar.classList.contains('collapsed')) {
            icon.setAttribute('data-lucide', 'panel-right-open');
        } else {
            icon.setAttribute('data-lucide', 'panel-right-close');
        }
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    });

    // 11. Premium Color Picker Interface
    const colorToolConfigs = [
        { toolId: 'foreColorTool', inputId: 'foreColor', command: 'foreColor' },
        { toolId: 'hiliteColorTool', inputId: 'hiliteColor', command: 'hiliteColor' },
        { toolId: 'pageColorTool', inputId: 'pageColor', command: 'pageColor' }
    ];

    const standardColors = [
        '#ffffff', '#000000', '#f44336', '#e91e63', '#9c27b0',
        '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
        '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b',
        '#ffc107', '#ff9800', '#ff5722', '#795548', '#9e9e9e'
    ];

    colorToolConfigs.forEach(config => {
        const tool = document.getElementById(config.toolId);
        const input = document.getElementById(config.inputId);
        const indicator = tool.querySelector('.color-indicator');

        // Create Palette
        const popover = document.createElement('div');
        popover.className = 'palette-popover';
        
        standardColors.forEach(color => {
            const dot = document.createElement('div');
            dot.className = 'palette-color';
            dot.style.backgroundColor = color;
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                applyColor(config, color);
                popover.classList.remove('active');
            });
            popover.appendChild(dot);
        });

        const advanced = document.createElement('div');
        advanced.className = 'palette-advanced';
        advanced.textContent = 'Advanced...';
        advanced.addEventListener('click', (e) => {
            e.stopPropagation();
            input.click();
            popover.classList.remove('active');
        });
        popover.appendChild(advanced);
        
        tool.appendChild(popover);

        // Toggle Logic
        tool.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other popovers
            document.querySelectorAll('.palette-popover').forEach(p => {
                if (p !== popover) p.classList.remove('active');
            });
            popover.classList.toggle('active');
        });

        // Sync Indicator
        input.addEventListener('input', () => {
            applyColor(config, input.value);
        });

        // Initialize indicator
        indicator.style.backgroundColor = input.value;
    });

    function applyColor(config, color) {
        const input = document.getElementById(config.inputId);
        const tool = document.getElementById(config.toolId);
        const indicator = tool.querySelector('.color-indicator');
        
        input.value = color;
        indicator.style.backgroundColor = color;
        
        if (config.command === 'pageColor') {
            editor.style.backgroundColor = color;
            autoSave();
        } else {
            document.execCommand(config.command, false, color);
            editor.focus();
        }
    }

    // Close popovers on click outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.palette-popover').forEach(p => p.classList.remove('active'));
    });

    // Check state on mouseup or keyup
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('keyup', updateToolbarState);
});
