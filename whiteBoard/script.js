window.addEventListener('load', () => {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('colorPicker');
    const sizeSlider = document.getElementById('sizeSlider');
    const sizeValue = document.getElementById('sizeValue');
    
    // UI Elements
    const fileBtn = document.getElementById('fileBtn');
    const fileMenu = document.getElementById('fileMenu');
    const moreToolsBtn = document.getElementById('moreToolsBtn');
    const moreToolsMenu = document.getElementById('moreToolsMenu');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const rightSidebar = document.getElementById('rightSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');

    // Tool buttons
    const selectBtn = document.getElementById('selectBtn');
    const brushBtn = document.getElementById('brushBtn');
    const rectBtn = document.getElementById('rectBtn');
    const circleBtn = document.getElementById('circleBtn');
    const triangleBtn = document.getElementById('triangleBtn');
    const diamondBtn = document.getElementById('diamondBtn');
    const parallelogramBtn = document.getElementById('parallelogramBtn');
    const roundedRectBtn = document.getElementById('roundedRectBtn');
    const databaseBtn = document.getElementById('databaseBtn');
    const hexagonBtn = document.getElementById('hexagonBtn');
    const arrowBtn = document.getElementById('arrowBtn');
    const lineBtn = document.getElementById('lineBtn');
    const eraserBtn = document.getElementById('eraserBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    const allToolBtns = [
        selectBtn, brushBtn, rectBtn, circleBtn, triangleBtn, diamondBtn, 
        parallelogramBtn, roundedRectBtn, databaseBtn, hexagonBtn,
        arrowBtn, lineBtn, eraserBtn
    ];

    const sidebarToolBtns = Array.from(document.querySelectorAll('.sidebar-tool-btn'));

    // --- State ---
    let isDrawing = false;
    let isPanning = false;
    let isDragging = false;
    let isSelecting = false;
    let currentTool = 'brush';
    let currentColor = '#000000';
    let currentSize = 5;

    // History State
    let undoStack = [];
    let redoStack = [];

    // Camera State
    let offsetX = window.innerWidth / 2;
    let offsetY = window.innerHeight / 2;
    let zoom = 1;
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 5;

    // Data State
    let objects = [];
    let activeObject = null;
    let selectedObjects = [];
    let selectionBox = null;

    let lastMouseX = 0;
    let lastMouseY = 0;
    let dragStartX = 0;
    let dragStartY = 0;

    // --- Initialization ---
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        render();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function toWorld(screenX, screenY) {
        return {
            x: (screenX - offsetX) / zoom,
            y: (screenY - offsetY) / zoom
        };
    }

    function pushToHistory() {
        undoStack.push(JSON.stringify(objects));
        redoStack = []; // Clear redo on new action
        if (undoStack.length > 50) undoStack.shift();
    }

    function undo() {
        if (undoStack.length === 0) return;
        redoStack.push(JSON.stringify(objects));
        objects = JSON.parse(undoStack.pop());
        selectedObjects = [];
        render();
    }

    function redo() {
        if (redoStack.length === 0) return;
        undoStack.push(JSON.stringify(objects));
        objects = JSON.parse(redoStack.pop());
        selectedObjects = [];
        render();
    }

    function getHitObject(worldPos) {
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            const margin = (obj.size / 2) + 5;
            const bounds = getObjectBounds(obj);
            if (worldPos.x >= bounds.minX - margin && worldPos.x <= bounds.maxX + margin &&
                worldPos.y >= bounds.minY - margin && worldPos.y <= bounds.maxY + margin) {
                if (obj.type === 'brush' || obj.type === 'eraser' || obj.type === 'line' || obj.type === 'arrow') {
                    for (let j = 0; j < obj.points.length - 1; j++) {
                        if (isPointNearSegment(worldPos, obj.points[j], obj.points[j+1], margin)) return obj;
                    }
                } else return obj;
            }
        }
        return null;
    }

    function isPointNearSegment(p, a, b, tolerance) {
        const l2 = Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2);
        if (l2 === 0) return Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2)) < tolerance;
        let t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
        const dist = Math.sqrt(Math.pow(p.x - (a.x + t * (b.x - a.x)), 2) + Math.pow(p.y - (a.y + t * (b.y - a.y)), 2));
        return dist < tolerance;
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoom, zoom);
        objects.forEach(drawObject);
        if (activeObject) drawObject(activeObject);
        if (currentTool === 'select') {
            selectedObjects.forEach(obj => {
                const b = getObjectBounds(obj);
                ctx.setLineDash([5, 5]); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5 / zoom;
                ctx.strokeRect(b.minX - 5, b.minY - 5, (b.maxX - b.minX) + 10, (b.maxY - b.minY) + 10);
            });
            ctx.setLineDash([]);
            if (selectionBox) {
                ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1 / zoom;
                const r = {
                    x: Math.min(selectionBox.startWorld.x, selectionBox.endWorld.x),
                    y: Math.min(selectionBox.startWorld.y, selectionBox.endWorld.y),
                    w: Math.abs(selectionBox.endWorld.x - selectionBox.startWorld.x),
                    h: Math.abs(selectionBox.endWorld.y - selectionBox.startWorld.y)
                };
                ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeRect(r.x, r.y, r.w, r.h);
            }
        }
        ctx.restore();
    }

    function getObjectBounds(obj) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        obj.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
        if (obj.type === 'circle') {
            const r = Math.sqrt(Math.pow(obj.points[1].x - obj.points[0].x, 2) + Math.pow(obj.points[1].y - obj.points[0].y, 2));
            minX = Math.min(minX, obj.points[0].x - r); minY = Math.min(minY, obj.points[0].y - r);
            maxX = Math.max(maxX, obj.points[0].x + r); maxY = Math.max(maxY, obj.points[0].y + r);
        }
        return { minX, minY, maxX, maxY };
    }

    function drawObject(obj) {
        if (obj.points.length < 1) return;
        ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = obj.size;
        ctx.strokeStyle = obj.type === 'eraser' ? '#ffffff' : obj.color;
        const p1 = obj.points[0]; const p2 = obj.points[obj.points.length - 1] || p1;
        
        const x = p1.x; const y = p1.y;
        const w = p2.x - p1.x; const h = p2.y - p1.y;

        switch (obj.type) {
            case 'brush':
            case 'eraser':
                if (obj.points.length < 2) return;
                ctx.moveTo(p1.x, p1.y); for (let i = 1; i < obj.points.length; i++) ctx.lineTo(obj.points[i].x, obj.points[i].y);
                break;
            case 'rect': ctx.strokeRect(x, y, w, h); return;
            case 'roundedRect':
                const r = Math.min(Math.abs(w), Math.abs(h)) * 0.2;
                ctx.roundRect(x, y, w, h, r); break;
            case 'circle': ctx.arc(p1.x, p1.y, Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)), 0, Math.PI * 2); break;
            case 'line': ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); break;
            case 'triangle':
                ctx.moveTo(x + w / 2, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.closePath(); break;
            case 'diamond':
                ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2);
                ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); break;
            case 'parallelogram':
                const skew = w * 0.2;
                ctx.moveTo(x + skew, y); ctx.lineTo(x + w, y);
                ctx.lineTo(x + w - skew, y + h); ctx.lineTo(x, y + h); ctx.closePath(); break;
            case 'hexagon':
                const hSide = h / 2;
                const wSide = w * 0.25;
                ctx.moveTo(x + wSide, y); ctx.lineTo(x + w - wSide, y);
                ctx.lineTo(x + w, y + hSide); ctx.lineTo(x + w - wSide, y + h);
                ctx.lineTo(x + wSide, y + h); ctx.lineTo(x, y + hSide); ctx.closePath(); break;
            case 'database':
                const ellipseH = h * 0.2;
                ctx.ellipse(x + w / 2, y + ellipseH / 2, Math.abs(w / 2), Math.abs(ellipseH / 2), 0, 0, Math.PI * 2);
                ctx.moveTo(x, y + ellipseH / 2); ctx.lineTo(x, y + h - ellipseH / 2);
                ctx.ellipse(x + w / 2, y + h - ellipseH / 2, Math.abs(w / 2), Math.abs(ellipseH / 2), 0, 0, Math.PI);
                ctx.moveTo(x + w, y + h - ellipseH / 2); ctx.lineTo(x + w, y + ellipseH / 2);
                break;
            case 'arrow':
                ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x); const headLen = 15;
                ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(p2.x, p2.y); ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
                break;
        }
        ctx.stroke();
    }

    // --- Interaction ---
    function handlePointerDown(e) {
        if (!fileMenu.classList.contains('hidden')) fileMenu.classList.add('hidden');
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const worldPos = toWorld(clientX, clientY);
        if (e.button === 1 || e.button === 2 || (e.shiftKey && e.button === 0)) {
            isPanning = true; lastMouseX = clientX; lastMouseY = clientY;
            canvas.style.cursor = 'grabbing'; return;
        }
        if (currentTool === 'select') {
            const hit = getHitObject(worldPos);
            if (hit) {
                if (!selectedObjects.includes(hit)) selectedObjects = e.ctrlKey ? [...selectedObjects, hit] : [hit];
                isDragging = true; dragStartX = worldPos.x; dragStartY = worldPos.y;
                canvas.style.cursor = 'move';
            } else { isSelecting = true; selectedObjects = []; selectionBox = { startWorld: worldPos, endWorld: worldPos }; }
            render(); return;
        }
        if (e.button === 0 || (e.touches && e.touches.length === 1)) {
            isDrawing = true; activeObject = { type: currentTool, points: [worldPos], color: currentColor, size: currentSize };
            selectedObjects = [];
        }
    }

    function handlePointerMove(e) {
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const worldPos = toWorld(clientX, clientY);
        if (isPanning) {
            offsetX += clientX - lastMouseX; offsetY += clientY - lastMouseY;
            lastMouseX = clientX; lastMouseY = clientY; render();
        } else if (isDragging && selectedObjects.length > 0) {
            const dx = worldPos.x - dragStartX; const dy = worldPos.y - dragStartY;
            selectedObjects.forEach(obj => obj.points = obj.points.map(p => ({ x: p.x + dx, y: p.y + dy })));
            dragStartX = worldPos.x; dragStartY = worldPos.y; render();
        } else if (isSelecting && selectionBox) { selectionBox.endWorld = worldPos; render(); }
        else if (isDrawing && activeObject) {
            if (activeObject.type === 'brush' || activeObject.type === 'eraser') activeObject.points.push(worldPos);
            else if (activeObject.points.length > 1) activeObject.points[1] = worldPos;
            else activeObject.points.push(worldPos);
            render();
        }
    }

    function handlePointerUp() {
        if (isDrawing && activeObject) { 
            pushToHistory();
            objects.push(activeObject); 
            activeObject = null; 
        }
        else if (isDragging && selectedObjects.length > 0) {
            // History was pushed at start of drag if needed, 
            // but simpler to push at end of move
            // Actually, we should push BEFORE the change
        }
        else if (isSelecting && selectionBox) {
            const r = {
                x1: Math.min(selectionBox.startWorld.x, selectionBox.endWorld.x),
                x2: Math.max(selectionBox.startWorld.x, selectionBox.endWorld.x),
                y1: Math.min(selectionBox.startWorld.y, selectionBox.endWorld.y),
                y2: Math.max(selectionBox.startWorld.y, selectionBox.endWorld.y)
            };
            selectedObjects = objects.filter(obj => { const b = getObjectBounds(obj); return b.minX >= r.x1 && b.maxX <= r.x2 && b.minY >= r.y1 && b.maxY <= r.y2; });
            selectionBox = null;
        }
        isDrawing = false; isPanning = false; isDragging = false; isSelecting = false;
        canvas.style.cursor = currentTool === 'select' ? 'default' : 'crosshair';
        render();
    }

    canvas.addEventListener('mousedown', (e) => {
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const worldPos = toWorld(clientX, clientY);
        if (currentTool === 'select' && getHitObject(worldPos) && e.button === 0) {
            pushToHistory(); // Push before dragging
        }
        handlePointerDown(e);
    });
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => {
        e.preventDefault(); const worldPos = toWorld(e.clientX, e.clientY);
        zoom = Math.min(Math.max(zoom - e.deltaY * 0.001, MIN_ZOOM), MAX_ZOOM);
        offsetX = e.clientX - worldPos.x * zoom; offsetY = e.clientY - worldPos.y * zoom; render();
    }, { passive: false });

    // UI Listeners
    sidebarToggleBtn.addEventListener('click', () => rightSidebar.classList.toggle('open'));
    closeSidebarBtn.addEventListener('click', () => rightSidebar.classList.remove('open'));
    
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    fileBtn.addEventListener('click', e => { 
        e.stopPropagation(); 
        fileMenu.classList.toggle('hidden');
        moreToolsMenu.classList.add('hidden');
    });

    moreToolsBtn.addEventListener('click', e => {
        e.stopPropagation();
        moreToolsMenu.classList.toggle('hidden');
        fileMenu.classList.add('hidden');
    });

    // Close menus when clicking anywhere else
    window.addEventListener('click', () => {
        fileMenu.classList.add('hidden');
        moreToolsMenu.classList.add('hidden');
    });

    document.getElementById('newFileBtn').addEventListener('click', () => { if (confirm('Clear everything?')) { pushToHistory(); objects = []; selectedObjects = []; render(); } fileMenu.classList.add('hidden'); });
    document.getElementById('saveFileBtn').addEventListener('click', () => { localStorage.setItem('whiteboard_save', JSON.stringify({ objects, offsetX, offsetY, zoom })); alert('Saved!'); fileMenu.classList.add('hidden'); });
    document.getElementById('loadFileBtn').addEventListener('click', () => {
        const saved = localStorage.getItem('whiteboard_save');
        if (saved) { pushToHistory(); const data = JSON.parse(saved); objects = data.objects; offsetX = data.offsetX; offsetY = data.offsetY; zoom = data.zoom; render(); alert('Loaded!'); }
        fileMenu.classList.add('hidden');
    });
    document.getElementById('exportFileBtn').addEventListener('click', () => {
        if (objects.length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        objects.forEach(obj => { const b = getObjectBounds(obj); minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY); });
        const p = 50; const temp = document.createElement('canvas');
        temp.width = (maxX - minX) + p * 2; temp.height = (maxY - minY) + p * 2;
        const tCtx = temp.getContext('2d'); tCtx.fillStyle = '#ffffff'; tCtx.fillRect(0, 0, temp.width, temp.height);
        tCtx.translate(-minX + p, -minY + p);
        alert('Exporting PNG...');
        fileMenu.classList.add('hidden');
    });

    const setTool = (tool) => {
        currentTool = tool;
        
        // Sync toolbar buttons
        allToolBtns.forEach(btn => btn.classList.toggle('active', btn.id === tool + 'Btn'));
        
        // Sync sidebar buttons
        sidebarToolBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tool === tool));
        
        // Check if the current tool is inside the "More" menu
        const moreTools = ['triangle', 'diamond', 'parallelogram', 'roundedRect', 'database', 'hexagon', 'arrow', 'line'];
        moreToolsBtn.classList.toggle('active', moreTools.includes(tool));
        
        canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
        if (tool !== 'select') selectedObjects = []; 
        
        moreToolsMenu.classList.add('hidden');
        render();
    };

    allToolBtns.forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setTool(btn.id.replace('Btn', ''));
    }));

    sidebarToolBtns.forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setTool(btn.dataset.tool);
        rightSidebar.classList.remove('open'); // Close sidebar on selection
    }));

    window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) {
            if (k === 'z') { e.preventDefault(); undo(); }
            else if (k === 'y') { e.preventDefault(); redo(); }
        } else {
            if (k === 's') setTool('select'); else if (k === 'b') setTool('brush'); else if (k === 'r') setTool('rect');
            else if (k === 'o') setTool('circle'); else if (k === 't') setTool('triangle'); else if (k === 'd') setTool('diamond');
            else if (k === 'i') setTool('parallelogram'); else if (k === 'm') setTool('roundedRect');
            else if (k === 'a') setTool('arrow'); else if (k === 'l') setTool('line'); else if (k === 'e') setTool('eraser');
            else if (k === 'delete' || k === 'backspace') { 
                if (selectedObjects.length > 0) {
                    pushToHistory();
                    objects = objects.filter(o => !selectedObjects.includes(o)); 
                    selectedObjects = []; 
                    render(); 
                }
            }
        }
    });

    colorPicker.addEventListener('input', e => currentColor = e.target.value);
    sizeSlider.addEventListener('input', e => {
        currentSize = parseInt(e.target.value);
        sizeValue.textContent = currentSize;
    });

    render();
});
