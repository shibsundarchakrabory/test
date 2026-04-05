/**
 * ViveView MindMap - Core Logic
 * Author: Antigravity
 */

class MindMap {
    constructor() {
        this.nodes = [];
        this.links = [];
        this.zoom = 1;
        this.offset = { x: 0, y: 0 };
        this.isPanning = false;
        this.dragNodeId = null;
        this.lastMousePos = { x: 0, y: 0 };
        this.storageKey = 'viveview_mindmap_data';
        this.theme = 'cosmic';
        this.historyStack = [];
        this.redoStack = [];
        this.selectedNodeIds = []; // Upgraded to array for multi-selection
        this.searchQuery = '';

        // DOM Elements
        this.canvas = document.getElementById('mindMapCanvas');
        this.viewport = document.getElementById('mindMapViewport');
        this.nodesGroup = document.getElementById('nodesGroup');
        this.linksGroup = document.getElementById('linksGroup');
        this.propPanel = document.getElementById('propertiesPanel');
        this.nodeTextarea = document.getElementById('nodeText');
        this.minimapSvg = document.getElementById('minimapSvg');
        this.minimapRect = document.getElementById('minimapViewportRect');
        this.outlineModal = document.getElementById('outlineModal');
        this.outlineContent = document.getElementById('outlineContent');
        this.studyNotesTextarea = document.getElementById('studyNotes');

        this.init();
    }

    init() {
        this.loadFromStorage();
        if (this.nodes.length === 0) {
            this.addNode(window.innerWidth / 2, window.innerHeight / 2, "Central Topic", "node-gradient-blue", null, "pill");
        }
        
        this.setTheme(this.theme);
        this.setupEventListeners();
        this.render();
        this.updateTransform();
    }

    setupEventListeners() {
        // Zooming with Wheel
        this.viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.001;
            const delta = -e.deltaY;
            const newZoom = Math.min(Math.max(this.zoom + delta * zoomSpeed, 0.2), 5);
            
            // Adjust offset to zoom relative to mouse position
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const dx = (mouseX - this.offset.x) / this.zoom;
            const dy = (mouseY - this.offset.y) / this.zoom;
            
            this.zoom = newZoom;
            this.offset.x = mouseX - dx * this.zoom;
            this.offset.y = mouseY - dy * this.zoom;
            
            this.updateTransform();
        }, { passive: false });

        // Mouse Down for Panning or Dragging
        this.viewport.addEventListener('mousedown', (e) => {
            const target = e.target.closest('.node-group');
            this.lastMousePos = { x: e.clientX, y: e.clientY };

            if (target) {
                const id = target.dataset.id;
                if (e.ctrlKey || e.metaKey) {
                    // Toggle selection
                    if (this.selectedNodeIds.includes(id)) {
                        this.selectedNodeIds = this.selectedNodeIds.filter(nid => nid !== id);
                    } else {
                        this.selectedNodeIds.push(id);
                    }
                    this.selectNode(null, true); // Update visuals without resetting list
                } else {
                    // Simple select (unless already part of selection)
                    if (!this.selectedNodeIds.includes(id)) {
                        this.selectedNodeIds = [id];
                    }
                    this.dragNodeId = id;
                    this.selectNode(id);
                    this.saveHistory();
                }
            } else {
                this.isPanning = true;
                this.viewport.style.cursor = 'grabbing';
                this.selectedNodeIds = [];
                this.selectNode(null);
            }
        });

        // Mouse Move
        window.addEventListener('mousemove', (e) => {
            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;
            this.lastMousePos = { x: e.clientX, y: e.clientY };

            if (this.isPanning) {
                this.offset.x += dx;
                this.offset.y += dy;
                this.updateTransform();
            } else if (this.dragNodeId) {
                // Batch dragging
                this.selectedNodeIds.forEach(id => {
                    const node = this.nodes.find(n => n.id === id);
                    if (node) {
                        node.x += dx / this.zoom;
                        node.y += dy / this.zoom;
                        this.updateNodeElement(node);
                    }
                });
                this.renderLinks();
            }
        });

        // Mouse Up
        window.addEventListener('mouseup', () => {
            if (this.dragNodeId) this.saveToStorage();
            this.isPanning = false;
            this.dragNodeId = null;
            this.viewport.style.cursor = 'grab';
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'TEXTAREA') return;

            if (e.key === 'Tab') {
                e.preventDefault();
                const node = this.nodes.find(n => n.id === this.selectedNodeIds[0]);
                if (node) this.addChildToNode(node);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const node = this.nodes.find(n => n.id === this.selectedNodeIds[0]);
                if (node && node.parentId) {
                    const parent = this.nodes.find(n => n.id === node.parentId);
                    this.addChildToNode(parent);
                }
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedNodeIds.length > 0 && this.nodes.length > 1) {
                    this.saveHistory();
                    this.selectedNodeIds.forEach(id => this.deleteNode(id));
                    this.selectedNodeIds = [];
                    this.selectNode(null);
                }
            }

            // Undo / Redo Shortcuts
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }

            // Global Shortcuts for Files
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.exportToJSON();
            }
            if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                document.getElementById('importInput').click();
            }
        });

        // Toolbar Actions
        const newBtn = document.getElementById('newBtn');
        if (newBtn) {
            newBtn.onclick = () => {
                if (confirm('Are you sure you want to start a new mind map?')) {
                    this.nodes = [];
                    this.selectedNodeIds = [];
                    this.historyStack = [];
                    this.redoStack = [];
                    this.loadFromStorage();
                    if (this.nodes.length === 0) {
                        this.addNode(window.innerWidth / 2, window.innerHeight / 2, "Central Topic", "node-gradient-blue", null, "pill");
                    }
                    this.render();
                    this.saveToStorage();
                }
            };
        }

        document.getElementById('importBtn').onclick = () => document.getElementById('importInput').click();
        document.getElementById('importInput').onchange = (e) => this.importFromJSON(e.target.files[0]);
        
        document.getElementById('saveBtn').onclick = () => {
            this.saveToStorage();
            this.exportToJSON();
        };

        document.getElementById('exportJSONBtn').onclick = () => this.exportToJSON();
        document.getElementById('exportBtn').onclick = () => this.exportToPNG();

        document.getElementById('zoomInBtn').onclick = () => this.handleZoom(0.2);
        document.getElementById('zoomOutBtn').onclick = () => this.handleZoom(-0.2);
        document.getElementById('resetViewBtn').onclick = () => this.resetView();
        
        document.getElementById('autoLayoutBtn').onclick = () => {
            this.saveHistory();
            this.autoLayout();
        };

        document.getElementById('outlineBtn').onclick = () => this.showOutline();
        document.getElementById('closeOutlineBtn').onclick = () => this.outlineModal.classList.add('hidden');
        document.getElementById('copyOutlineBtn').onclick = () => {
            navigator.clipboard.writeText(this.outlineContent.textContent);
            const span = document.querySelector('#copyOutlineBtn span');
            const original = span.textContent;
            span.textContent = 'Copied!';
            setTimeout(() => span.textContent = original, 2000);
        };

        // History Actions UI
        document.getElementById('undoBtn').onclick = () => this.undo();
        document.getElementById('redoBtn').onclick = () => this.redo();

        // Search Input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.render();
            };
        }

        // Theme Toggle Button — cycles Cosmic → Minimalist → Midnight
        const themes = ['cosmic', 'minimalist', 'midnight'];
        const themeIcons = { cosmic: 'moon', minimalist: 'sun', midnight: 'star' };
        const themeLabels = { cosmic: 'Cosmic', minimalist: 'Minimalist', midnight: 'Midnight' };

        const updateThemeBtn = () => {
            const btn = document.getElementById('themeToggleBtn');
            if (!btn) return;
            btn.title = `Theme: ${themeLabels[this.theme]}`;
            btn.innerHTML = `<i data-lucide="${themeIcons[this.theme]}"></i>`;
            lucide.createIcons();
        };

        document.getElementById('themeToggleBtn').onclick = () => {
            const idx = themes.indexOf(this.theme);
            const next = themes[(idx + 1) % themes.length];
            this.saveHistory();
            this.setTheme(next);
            updateThemeBtn();
        };

        updateThemeBtn(); // Set correct icon on load

        // Legacy dropdown (if still in DOM)
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) {
            themeSelector.value = this.theme;
            themeSelector.onchange = (e) => {
                this.saveHistory();
                this.setTheme(e.target.value);
                updateThemeBtn();
            };
        }

        document.getElementById('addNodeBtn').onclick = () => {
            const parent = this.nodes.find(n => n.id === this.selectedNodeIds[0]) || this.nodes[0];
            this.addChildToNode(parent);
        };

        document.getElementById('deleteNodeBtn').onclick = () => {
            const id = this.selectedNodeIds[0];
            if (id && this.nodes.length > 1) {
                this.saveHistory();
                this.deleteNode(id);
            }
        };

        // Properties Panel Sync
        this.nodeTextarea.oninput = (e) => {
            const node = this.nodes.find(n => this.selectedNodeIds.includes(n.id));
            if (node) {
                node.text = e.target.value;
                this.updateNodeElement(node);
                this.saveToStorage();
            }
        };

        this.studyNotesTextarea.oninput = (e) => {
            const node = this.nodes.find(n => this.selectedNodeIds.includes(n.id));
            if (node) {
                node.notes = e.target.value;
                this.saveToStorage();
            }
        };

        // Shape Picker
        document.querySelectorAll('.shape-option').forEach(opt => {
            opt.onclick = () => {
                const shape = opt.dataset.shape;
                this.saveHistory();
                this.selectedNodeIds.forEach(id => {
                    const node = this.nodes.find(n => n.id === id);
                    if (node) {
                        node.shape = shape;
                        this.updateNodeElement(node);
                    }
                });
                document.querySelectorAll('.shape-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                this.saveToStorage();
            };
        });

        // Double Click to add Node
        this.viewport.ondblclick = (e) => {
            if (e.target === this.canvas || e.target.id === 'mindMapCanvas') {
                const rect = this.canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left - this.offset.x) / this.zoom;
                const y = (e.clientY - rect.top - this.offset.y) / this.zoom;
                this.addNode(x, y, "New Idea", "node-gradient-violet", this.selectedNodeIds[0] || null, "pill");
            }
        };

        // Child node button in panel
        document.getElementById('addChildBtn').onclick = () => {
            const node = this.nodes.find(n => n.id === this.selectedNodeIds[0]);
            if (node) this.addChildToNode(node);
        };

        // Color Picker
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.onclick = () => {
                const nodeClass = opt.dataset.class;
                this.saveHistory();
                this.selectedNodeIds.forEach(id => {
                    const node = this.nodes.find(n => n.id === id);
                    if (node) {
                        node.color = nodeClass;
                        this.updateNodeElement(node);
                    }
                });
                document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                this.saveToStorage();
            };
        });

        // Status Selector
        document.querySelectorAll('.status-option').forEach(opt => {
            opt.onclick = () => {
                const status = opt.dataset.status;
                this.saveHistory();
                this.selectedNodeIds.forEach(id => {
                    const node = this.nodes.find(n => n.id === id);
                    if (node) {
                        node.status = status;
                        this.updateNodeElement(node);
                    }
                });
                document.querySelectorAll('.status-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                this.saveToStorage();
            };
        });

        document.getElementById('closePanelBtn').onclick = () => this.selectNode(null);

        document.getElementById('toggleFoldBtn').onclick = () => {
            const node = this.nodes.find(n => n.id === this.selectedNodeIds[0]);
            if (node) {
                node.folded = !node.folded;
                this.render();
                this.saveToStorage();
            }
        };
    }

    addNode(x, y, text, color, parentId, shape = 'pill') {
        const id = 'node-' + Date.now() + Math.random().toString(36).substr(2, 5);
        const node = { 
            id, x, y, text, color, parentId, shape, 
            folded: false, 
            status: 'none', 
            notes: '' 
        };
        this.nodes.push(node);
        this.renderNode(node);
        this.renderLinks();
        this.selectNode(id);
        this.saveToStorage();
        this.updateMinimap();
        return node;
    }

    addChildToNode(parent) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 180;
        const x = parent.x + Math.cos(angle) * dist;
        const y = parent.y + Math.sin(angle) * dist;
        this.addNode(x, y, "Subtopic", parent.color, parent.id, parent.shape);
    }

    deleteNode(id) {
        // Delete node and its children recursively
        const toDelete = [id];
        const findChildren = (pid) => {
            this.nodes.filter(n => n.parentId === pid).forEach(child => {
                toDelete.push(child.id);
                findChildren(child.id);
            });
        };
        findChildren(id);

        this.nodes = this.nodes.filter(n => !toDelete.includes(n.id));
        this.render();
        this.selectNode(null);
        this.saveToStorage();
    }

    selectNode(id, keepList = false) {
        if (!keepList) {
            if (id) {
                this.selectedNodeIds = [id];
            } else {
                this.selectedNodeIds = [];
            }
        }

        document.querySelectorAll('.node-group').forEach(el => {
            el.classList.toggle('active', this.selectedNodeIds.includes(el.dataset.id));
        });

        if (this.selectedNodeIds.length === 1) {
            const node = this.nodes.find(n => n.id === this.selectedNodeIds[0]);
            this.propPanel.classList.remove('hidden');
            this.nodeTextarea.value = node.text;
            this.studyNotesTextarea.value = node.notes || '';
            
            // Update fold button text
            const foldBtnLabel = document.querySelector('#toggleFoldBtn span');
            if (foldBtnLabel) foldBtnLabel.textContent = node.folded ? 'Expand Subtree' : 'Collapse Subtree';
            
            // Highlight selected options
            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.class === node.color);
            });
            document.querySelectorAll('.shape-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.shape === node.shape);
            });
            document.querySelectorAll('.status-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.status === node.status);
            });
        } else {
            this.propPanel.classList.add('hidden');
        }
    }

    updateTransform() {
        this.nodesGroup.setAttribute('transform', `translate(${this.offset.x}, ${this.offset.y}) scale(${this.zoom})`);
        this.linksGroup.setAttribute('transform', `translate(${this.offset.x}, ${this.offset.y}) scale(${this.zoom})`);
        this.updateMinimap();
    }

    handleZoom(delta) {
        this.zoom = Math.min(Math.max(this.zoom + delta, 0.2), 5);
        this.updateTransform();
    }

    resetView() {
        this.zoom = 1;
        this.offset = { x: 0, y: 0 };
        this.updateTransform();
    }

    setTheme(theme) {
        this.theme = theme;
        document.body.className = theme === 'cosmic' ? '' : theme;
        this.saveToStorage();
    }

    render() {
        this.nodesGroup.innerHTML = '';
        this.renderLinks();
        
        // Filter out nodes whose parent is folded
        const visibleNodes = this.nodes.filter(node => {
            let pId = node.parentId;
            while (pId) {
                const parent = this.nodes.find(n => n.id === pId);
                if (parent && parent.folded) return false;
                pId = parent ? parent.parentId : null;
            }
            return true;
        });

        visibleNodes.forEach(node => this.renderNode(node));
        this.updateMinimap();
    }

    renderNode(node) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const isMatch = this.searchQuery && node.text.toLowerCase().includes(this.searchQuery);
        g.setAttribute('class', 'node-group' + (node.folded ? ' folded' : '') + (isMatch ? ' search-match' : ''));
        g.setAttribute('data-id', node.id);
        g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

        const shape = document.createElementNS('http://www.w3.org/2000/svg', 
            node.shape === 'circle' ? 'circle' : 
            node.shape === 'diamond' ? 'path' : 'rect'
        );
        shape.setAttribute('class', 'node-body');
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'node-text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.textContent = node.text;

        g.appendChild(shape);
        g.appendChild(text);
        this.nodesGroup.appendChild(g);

        this.updateNodeElement(node);
    }

    updateNodeElement(node) {
        let g = this.nodesGroup.querySelector(`[data-id="${node.id}"]`);
        if (!g) return;

        // If shape mismatch, recreate the body
        let body = g.querySelector('.node-body');
        const expectedTag = node.shape === 'circle' ? 'circle' : node.shape === 'diamond' ? 'path' : 'rect';
        if (body.tagName.toLowerCase() !== expectedTag) {
            const newBody = document.createElementNS('http://www.w3.org/2000/svg', expectedTag);
            newBody.setAttribute('class', 'node-body');
            g.replaceChild(newBody, body);
            body = newBody;
        }

        g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        const text = g.querySelector('.node-text');
        text.textContent = node.text;
        
        const bbox = text.getBBox();
        const paddingX = 48;
        const paddingY = 24;
        let width = Math.max(bbox.width + paddingX, 140);
        let height = Math.max(bbox.height + paddingY, 48);

        if (node.shape === 'circle') {
            const r = Math.max(width, height) / 2;
            body.setAttribute('r', r);
            body.setAttribute('cx', 0);
            body.setAttribute('cy', 0);
        } else if (node.shape === 'diamond') {
            const w = width * 1.2; // Diamond needs more width
            const h = height * 1.2;
            const path = `M 0 ${-h/2} L ${w/2} 0 L 0 ${h/2} L ${-w/2} 0 Z`;
            body.setAttribute('d', path);
        } else {
            // Rect or Pill
            body.setAttribute('width', width);
            body.setAttribute('height', height);
            body.setAttribute('x', -width / 2);
            body.setAttribute('y', -height / 2);
            body.setAttribute('rx', node.shape === 'pill' ? height / 2 : 8);
        }

        // Add Status Dot if not none
        let statusDot = g.querySelector('.status-dot');
        if (node.status && node.status !== 'none') {
            if (!statusDot) {
                statusDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                statusDot.setAttribute('class', 'status-dot');
                g.appendChild(statusDot);
            }
            const dotColor = node.status === 'to-learn' ? '#ef4444' : 
                          node.status === 'learning' ? '#f59e0b' : '#10b981';
            statusDot.setAttribute('fill', dotColor);
            statusDot.setAttribute('r', 6);
            statusDot.setAttribute('cx', width / 2 - 12);
            statusDot.setAttribute('cy', -height / 2 + 12);
        } else if (statusDot) {
            statusDot.remove();
        }
        
        if (node.color.startsWith('node-gradient')) {
            body.setAttribute('class', `node-body ${node.color}`);
            body.removeAttribute('fill');
        } else {
            body.setAttribute('class', 'node-body');
            body.setAttribute('fill', node.color);
        }
    }

    renderLinks() {
        this.linksGroup.innerHTML = '';
        this.nodes.forEach(node => {
            if (node.parentId) {
                const parent = this.nodes.find(n => n.id === node.parentId);
                
                // Hide link if parent is folded
                let isParentHidden = false;
                let pId = node.parentId;
                while (pId) {
                    const p = this.nodes.find(n => n.id === pId);
                    if (p && p.folded) { isParentHidden = true; break; }
                    pId = p ? p.parentId : null;
                }

                if (parent && !isParentHidden) {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('class', 'link');
                    
                    // Smoother Bezier Curve with horizontal bias
                    const midX = (parent.x + node.x) / 2;
                    const d = `M ${parent.x} ${parent.y} C ${midX} ${parent.y}, ${midX} ${node.y}, ${node.x} ${node.y}`;
                    path.setAttribute('d', d);
                    
                    // Link color based on parent
                    const parentColor = parent.color.includes('blue') ? '#3b82f6' : 
                                      parent.color.includes('emerald') ? '#10b981' :
                                      parent.color.includes('violet') ? '#8b5cf6' :
                                      parent.color.includes('rose') ? '#f43f5e' : '#f59e0b';
                    path.setAttribute('stroke', parentColor);
                    this.linksGroup.appendChild(path);
                }
            }
        });
    }

    saveToStorage() {
        const data = {
            nodes: this.nodes,
            zoom: this.zoom,
            offset: this.offset,
            theme: this.theme
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    loadFromStorage() {
        const dataStr = localStorage.getItem(this.storageKey);
        if (dataStr) {
            const data = JSON.parse(dataStr);
            this.nodes = data.nodes.map(n => ({...n, folded: n.folded || false}));
            this.zoom = data.zoom || 1;
            this.offset = data.offset || { x: 0, y: 0 };
            this.theme = data.theme || 'cosmic';
            this.historyStack = [];
            this.redoStack = [];
        }
    }

    saveHistory() {
        const snapshot = JSON.stringify({
            nodes: this.nodes,
            theme: this.theme,
            selectedNodeIds: this.selectedNodeIds
        });
        this.historyStack.push(snapshot);
        if (this.historyStack.length > 50) this.historyStack.shift();
        this.redoStack = []; 
    }

    undo() {
        if (this.historyStack.length === 0) return;
        
        const currentState = JSON.stringify({
            nodes: this.nodes,
            theme: this.theme,
            selectedNodeIds: this.selectedNodeIds
        });
        this.redoStack.push(currentState);
        
        const previousState = JSON.parse(this.historyStack.pop());
        this.nodes = previousState.nodes;
        this.theme = previousState.theme;
        this.selectedNodeIds = previousState.selectedNodeIds || [];
        
        this.setTheme(this.theme);
        this.render();
        this.selectNode(this.selectedNodeIds[0], true);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        const currentState = JSON.stringify({
            nodes: this.nodes,
            theme: this.theme,
            selectedNodeIds: this.selectedNodeIds
        });
        this.historyStack.push(currentState);
        
        const nextState = JSON.parse(this.redoStack.pop());
        this.nodes = nextState.nodes;
        this.theme = nextState.theme;
        this.selectedNodeIds = nextState.selectedNodeIds || [];

        this.setTheme(this.theme);
        this.render();
        this.selectNode(this.selectedNodeIds[0], true);
    }

    showOutline() {
        const root = this.nodes.find(n => !n.parentId);
        if (!root) return;

        let outline = '';
        const buildOutline = (nodeId, depth) => {
            const node = this.nodes.find(n => n.id === nodeId);
            const prefix = '#'.repeat(depth + 1);
            outline += `${prefix} ${node.text}\n`;
            if (node.notes) outline += `${node.notes}\n\n`;
            
            const children = this.nodes.filter(n => n.parentId === nodeId);
            children.forEach(child => buildOutline(child.id, depth + 1));
        };

        buildOutline(root.id, 0);
        this.outlineContent.textContent = outline;
        this.outlineModal.classList.remove('hidden');
    }

    exportToJSON() {
        const data = {
            nodes: this.nodes,
            theme: this.theme,
            zoom: this.zoom,
            offset: this.offset,
            version: '1.1'
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mindmap_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importFromJSON(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.nodes) {
                    this.saveHistory();
                    this.nodes = data.nodes;
                    this.theme = data.theme || 'cosmic';
                    this.zoom = data.zoom || 1;
                    this.offset = data.offset || { x: 0, y: 0 };
                    this.setTheme(this.theme);
                    this.render();
                    this.updateTransform();
                    alert('Workspace imported successfully!');
                }
            } catch (err) {
                alert('Error importing JSON: Invalid file format.');
            }
        };
        reader.readAsText(file);
    }

    async exportToPNG() {
        const svg = document.getElementById('mindMapCanvas');
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        
        // Find map boundaries for cropping
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.nodes.forEach(n => {
            minX = Math.min(minX, n.x - 200);
            minY = Math.min(minY, n.y - 120);
            maxX = Math.max(maxX, n.x + 200);
            maxY = Math.max(maxY, n.y + 120);
        });

        const width = maxX - minX;
        const height = maxY - minY;

        // Use a Canvas to render the SVG
        const canvas = document.createElement('canvas');
        canvas.width = width * 2; // High DPI
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);

        // Fill background based on theme
        const themeBg = getComputedStyle(document.body).getPropertyValue('--bg-main');
        ctx.fillStyle = themeBg;
        ctx.fillRect(0, 0, width, height);

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            ctx.drawImage(img, -minX, -minY); // Shift to capture content
            URL.revokeObjectURL(url);
            
            const pngUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `mindmap_${Date.now()}.png`;
            a.click();
        };
        img.src = url;
    }

    autoLayout() {
        // Simple tree layout algorithm
        const root = this.nodes.find(n => !n.parentId);
        if (!root) return;

        const levelWidth = 300;
        const nodeHeight = 100;
        
        const layoutNode = (nodeId, level, yOffset) => {
            const children = this.nodes.filter(n => n.parentId === nodeId);
            const node = this.nodes.find(n => n.id === nodeId);
            
            node.x = level * levelWidth + window.innerWidth / 4;
            node.y = yOffset;
            
            let currentY = yOffset - ((children.length - 1) * nodeHeight) / 2;
            children.forEach(child => {
                currentY = layoutNode(child.id, level + 1, currentY);
            });
            
            return Math.max(yOffset + nodeHeight, currentY);
        };

        layoutNode(root.id, 0, window.innerHeight / 2);
        this.render();
        this.saveToStorage();
    }

    updateMinimap() {
        if (!this.minimapSvg) return;
        
        this.minimapSvg.innerHTML = '';
        const miniNodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Find map boundaries
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.nodes.forEach(n => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x);
            maxY = Math.max(maxY, n.y);
        });

        const padding = 200;
        const width = (maxX - minX) + padding * 2;
        const height = (maxY - minY) + padding * 2;
        
        const scale = Math.min(200 / width, 150 / height);
        miniNodesGroup.setAttribute('transform', `scale(${scale}) translate(${-minX + padding}, ${-minY + padding})`);

        this.nodes.forEach(node => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', node.x - 50);
            rect.setAttribute('y', node.y - 25);
            rect.setAttribute('width', 100);
            rect.setAttribute('height', 50);
            rect.setAttribute('fill', 'rgba(255,255,255,0.2)');
            rect.setAttribute('rx', 10);
            miniNodesGroup.appendChild(rect);
        });

        this.minimapSvg.appendChild(miniNodesGroup);

        // Update viewport rect
        const viewScale = scale / this.zoom;
        this.minimapRect.style.width = (window.innerWidth * scale / this.zoom) + 'px';
        this.minimapRect.style.height = (window.innerHeight * scale / this.zoom) + 'px';
        this.minimapRect.style.left = ((-this.offset.x / this.zoom - minX + padding) * scale) + 'px';
        this.minimapRect.style.top = ((-this.offset.y / this.zoom - minY + padding) * scale) + 'px';
    }
}

// Spark it up
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MindMap();
});
