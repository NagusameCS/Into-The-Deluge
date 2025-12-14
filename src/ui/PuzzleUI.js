/**
 * Puzzle UI - Renders and handles input for puzzles
 */

export class PuzzleUI {
    constructor() {
        this.puzzle = null;
        this.visible = false;
        this.x = 100;
        this.y = 80;
        this.width = 600;
        this.height = 400;
        this.onComplete = null;
        this.onClose = null;
        this.canvasWidth = 800;
        this.canvasHeight = 600;
        
        // Animation
        this.fadeIn = 0;
        this.selectedIndex = -1;
        this.hoverIndex = -1;
        
        // Bind methods
        this.handleClick = this.handleClick.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
    }
    
    show(puzzle, onComplete, onClose, canvasWidth = 800, canvasHeight = 600) {
        this.puzzle = puzzle;
        this.visible = true;
        this.fadeIn = 0;
        this.onComplete = onComplete;
        this.onClose = onClose;
        this.selectedIndex = -1;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        
        // Center on screen
        this.x = (this.canvasWidth - this.width) / 2;
        this.y = (this.canvasHeight - this.height) / 2;
    }
    
    close() {
        this.visible = false;
        this.puzzle = null;
        if (this.onClose) this.onClose();
    }
    
    hide() {
        this.close();
    }
    
    update(dt) {
        if (!this.visible || !this.puzzle) return;
        
        // Fade in animation
        if (this.fadeIn < 1) {
            this.fadeIn += dt * 3;
            if (this.fadeIn > 1) this.fadeIn = 1;
        }
        
        // Update puzzle-specific animations
        if (this.puzzle.update) {
            this.puzzle.update();
        }
        
        // Check if solved
        if (this.puzzle.solved) {
            setTimeout(() => {
                if (this.onComplete) this.onComplete();
                this.hide();
            }, 500);
        }
    }
    
    handleMouseMove(mouseX, mouseY) {
        if (!this.visible || !this.puzzle) return;
        
        this.hoverIndex = this.getClickedElement(mouseX, mouseY);
    }
    
    handleClick(mouseX, mouseY) {
        if (!this.visible || !this.puzzle) return false;
        
        // Check close button
        if (mouseX >= this.x + this.width - 40 && mouseX <= this.x + this.width - 10 &&
            mouseY >= this.y + 10 && mouseY <= this.y + 40) {
            this.hide();
            return true;
        }
        
        // Handle puzzle-specific clicks
        const clickedIndex = this.getClickedElement(mouseX, mouseY);
        if (clickedIndex >= 0) {
            this.handlePuzzleClick(clickedIndex, mouseX, mouseY);
            return true;
        }
        
        return false;
    }
    
    getClickedElement(mouseX, mouseY) {
        if (!this.puzzle) return -1;
        
        const contentX = this.x + 20;
        const contentY = this.y + 70;
        const contentW = this.width - 40;
        const contentH = this.height - 100;
        
        const type = this.puzzle.type;
        
        switch (type) {
            case 'pattern_memory':
                return this.getPatternMemoryClick(mouseX, mouseY, contentX, contentY);
            case 'tile_rotation':
                return this.getTileRotationClick(mouseX, mouseY, contentX, contentY);
            case 'simon_says':
                return this.getSimonSaysClick(mouseX, mouseY, contentX, contentY);
            case 'word_scramble':
                return this.getWordScrambleClick(mouseX, mouseY, contentX, contentY);
            case 'lock_picking':
                return this.getLockPickingClick(mouseX, mouseY, contentX, contentY);
            case 'constellation':
                return this.getConstellationClick(mouseX, mouseY, contentX, contentY);
            case 'rune_matching':
                return this.getRuneMatchingClick(mouseX, mouseY, contentX, contentY);
            case 'pressure_plates':
                return this.getPressurePlatesClick(mouseX, mouseY, contentX, contentY);
            case 'shadow_alignment':
                return this.getShadowAlignmentClick(mouseX, mouseY, contentX, contentY);
            case 'elemental_balance':
                return this.getElementalBalanceClick(mouseX, mouseY, contentX, contentY);
        }
        
        return -1;
    }
    
    handlePuzzleClick(index, mouseX, mouseY) {
        const type = this.puzzle.type;
        
        switch (type) {
            case 'pattern_memory':
                this.puzzle.addInput(index);
                break;
            case 'tile_rotation':
                const gridSize = this.puzzle.gridSize;
                const tileX = index % gridSize;
                const tileY = Math.floor(index / gridSize);
                this.puzzle.rotateTile(tileX, tileY);
                break;
            case 'simon_says':
                this.puzzle.pressButton(index);
                break;
            case 'word_scramble':
                if (index === 999) {
                    this.puzzle.resetGuess();
                } else {
                    this.puzzle.selectLetter(index);
                }
                break;
            case 'lock_picking':
                const pinIndex = Math.floor(index / 2);
                const direction = index % 2 === 0 ? 1 : -1;
                this.puzzle.adjustPin(pinIndex, direction);
                break;
            case 'constellation':
                this.puzzle.selectStar(index);
                break;
            case 'rune_matching':
                this.puzzle.flipCard(index);
                break;
            case 'pressure_plates':
                this.puzzle.pressPlate(index);
                break;
            case 'shadow_alignment':
                this.puzzle.rotateObject(index);
                break;
            case 'elemental_balance':
                // Index encodes vessel and element
                const vesselIdx = Math.floor(index / 4);
                const elementIdx = index % 4;
                const elements = ['fire', 'water', 'earth', 'air'];
                this.puzzle.addElement(vesselIdx, elements[elementIdx]);
                break;
        }
    }
    
    render(ctx) {
        if (!this.visible || !this.puzzle || !ctx) return;
        
        ctx.save();
        
        // Darken background
        ctx.globalAlpha = this.fadeIn * 0.7;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        ctx.globalAlpha = this.fadeIn;
        
        // Main panel
        ctx.fillStyle = '#1a1a2e';
        ctx.strokeStyle = '#4a4a6e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 10);
        ctx.fill();
        ctx.stroke();
        
        // Title bar
        ctx.fillStyle = '#2a2a4e';
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, 50, [10, 10, 0, 0]);
        ctx.fill();
        
        // Title
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.getPuzzleTitle(), this.x + this.width / 2, this.y + 35);
        
        // Close button
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(this.x + this.width - 25, this.y + 25, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('×', this.x + this.width - 25, this.y + 32);
        
        // Hint text
        ctx.fillStyle = '#aaa';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.puzzle.getHint(), this.x + this.width / 2, this.y + this.height - 15);
        
        // Attempts remaining
        if (this.puzzle.maxAttempts) {
            ctx.fillStyle = '#ff6666';
            ctx.textAlign = 'left';
            ctx.fillText(`Attempts: ${this.puzzle.maxAttempts - this.puzzle.attempts}`, this.x + 20, this.y + this.height - 15);
        }
        
        // Render puzzle content
        const contentX = this.x + 20;
        const contentY = this.y + 70;
        const contentW = this.width - 40;
        const contentH = this.height - 100;
        
        this.renderPuzzleContent(ctx, contentX, contentY, contentW, contentH);
        
        ctx.restore();
    }
    
    getPuzzleTitle() {
        const titles = {
            'pattern_memory': 'Pattern Memory',
            'tile_rotation': 'Pipe Connection',
            'simon_says': 'Light Sequence',
            'word_scramble': 'Ancient Word',
            'lock_picking': 'Lock Mechanism',
            'constellation': 'Star Map',
            'rune_matching': 'Rune Matching',
            'pressure_plates': 'Weight Order',
            'shadow_alignment': 'Shadow Casting',
            'elemental_balance': 'Elemental Balance'
        };
        return titles[this.puzzle.type] || 'Puzzle';
    }
    
    renderPuzzleContent(ctx, x, y, w, h) {
        switch (this.puzzle.type) {
            case 'pattern_memory':
                this.renderPatternMemory(ctx, x, y, w, h);
                break;
            case 'tile_rotation':
                this.renderTileRotation(ctx, x, y, w, h);
                break;
            case 'simon_says':
                this.renderSimonSays(ctx, x, y, w, h);
                break;
            case 'word_scramble':
                this.renderWordScramble(ctx, x, y, w, h);
                break;
            case 'lock_picking':
                this.renderLockPicking(ctx, x, y, w, h);
                break;
            case 'constellation':
                this.renderConstellation(ctx, x, y, w, h);
                break;
            case 'rune_matching':
                this.renderRuneMatching(ctx, x, y, w, h);
                break;
            case 'pressure_plates':
                this.renderPressurePlates(ctx, x, y, w, h);
                break;
            case 'shadow_alignment':
                this.renderShadowAlignment(ctx, x, y, w, h);
                break;
            case 'elemental_balance':
                this.renderElementalBalance(ctx, x, y, w, h);
                break;
        }
    }
    
    // Pattern Memory rendering
    renderPatternMemory(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        const centerX = x + w / 2;
        
        if (puzzle.phase === 'showing') {
            // Show the pattern
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Memorize this pattern:', centerX, y + 30);
            
            // Display pattern symbols
            const symbolSpacing = 50;
            const startX = centerX - (puzzle.pattern.length - 1) * symbolSpacing / 2;
            
            ctx.font = '36px Arial';
            for (let i = 0; i < puzzle.pattern.length; i++) {
                const symbol = puzzle.selectedSymbols[puzzle.pattern[i]];
                ctx.fillStyle = '#fff';
                ctx.fillText(symbol, startX + i * symbolSpacing, y + 100);
            }
        } else if (puzzle.phase === 'input') {
            // Input phase
            ctx.fillStyle = '#88ff88';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Click the symbols in the correct order:', centerX, y + 20);
            
            // Show current input
            ctx.fillStyle = '#fff';
            ctx.font = '28px Arial';
            const inputStr = puzzle.currentInput.map(i => puzzle.selectedSymbols[i]).join(' ');
            ctx.fillText(inputStr || '(click symbols below)', centerX, y + 60);
            
            // Display clickable symbols
            const btnSize = 60;
            const spacing = 80;
            const startX = centerX - (puzzle.selectedSymbols.length - 1) * spacing / 2;
            
            ctx.font = '36px Arial';
            for (let i = 0; i < puzzle.selectedSymbols.length; i++) {
                const bx = startX + i * spacing - btnSize / 2;
                const by = y + 100;
                
                // Button background
                ctx.fillStyle = this.hoverIndex === i ? '#4a4a8e' : '#3a3a5e';
                ctx.beginPath();
                ctx.roundRect(bx, by, btnSize, btnSize, 8);
                ctx.fill();
                
                // Symbol
                ctx.fillStyle = '#fff';
                ctx.fillText(puzzle.selectedSymbols[i], startX + i * spacing, by + 42);
            }
        }
    }
    
    getPatternMemoryClick(mx, my, x, y) {
        if (this.puzzle.phase !== 'input') return -1;
        
        const w = this.width - 40;
        const centerX = x + w / 2;
        const btnSize = 60;
        const spacing = 80;
        const startX = centerX - (this.puzzle.selectedSymbols.length - 1) * spacing / 2;
        const by = y + 100;
        
        for (let i = 0; i < this.puzzle.selectedSymbols.length; i++) {
            const bx = startX + i * spacing - btnSize / 2;
            if (mx >= bx && mx <= bx + btnSize && my >= by && my <= by + btnSize) {
                return i;
            }
        }
        return -1;
    }
    
    // Tile Rotation rendering
    renderTileRotation(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        const gridSize = puzzle.gridSize;
        const tileSize = Math.min(50, (w - 40) / gridSize);
        const startX = x + (w - gridSize * tileSize) / 2;
        const startY = y + 20;
        
        for (let ty = 0; ty < gridSize; ty++) {
            for (let tx = 0; tx < gridSize; tx++) {
                const tile = puzzle.tiles[ty][tx];
                const px = startX + tx * tileSize;
                const py = startY + ty * tileSize;
                
                // Tile background
                ctx.fillStyle = '#2a2a4e';
                ctx.strokeStyle = '#4a4a6e';
                ctx.lineWidth = 2;
                ctx.fillRect(px, py, tileSize - 2, tileSize - 2);
                ctx.strokeRect(px, py, tileSize - 2, tileSize - 2);
                
                // Draw pipe based on type and rotation
                ctx.save();
                ctx.translate(px + tileSize / 2 - 1, py + tileSize / 2 - 1);
                ctx.rotate(tile.rotation * Math.PI / 180);
                
                ctx.strokeStyle = '#66aaff';
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                
                const r = tileSize / 2 - 8;
                
                if (tile.type === 0) { // Straight
                    ctx.beginPath();
                    ctx.moveTo(-r, 0);
                    ctx.lineTo(r, 0);
                    ctx.stroke();
                } else if (tile.type === 1) { // Corner
                    ctx.beginPath();
                    ctx.moveTo(0, -r);
                    ctx.lineTo(0, 0);
                    ctx.lineTo(r, 0);
                    ctx.stroke();
                } else if (tile.type === 2) { // T-junction
                    ctx.beginPath();
                    ctx.moveTo(-r, 0);
                    ctx.lineTo(r, 0);
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, r);
                    ctx.stroke();
                } else { // Cross
                    ctx.beginPath();
                    ctx.moveTo(-r, 0);
                    ctx.lineTo(r, 0);
                    ctx.moveTo(0, -r);
                    ctx.lineTo(0, r);
                    ctx.stroke();
                }
                
                ctx.restore();
            }
        }
        
        // Start/End indicators
        ctx.fillStyle = '#44ff44';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('START', startX + tileSize / 2, startY - 5);
        ctx.fillStyle = '#ff4444';
        ctx.fillText('END', startX + (gridSize - 0.5) * tileSize, startY + gridSize * tileSize + 15);
    }
    
    getTileRotationClick(mx, my, x, y) {
        const puzzle = this.puzzle;
        const gridSize = puzzle.gridSize;
        const w = this.width - 40;
        const tileSize = Math.min(50, (w - 40) / gridSize);
        const startX = x + (w - gridSize * tileSize) / 2;
        const startY = y + 20;
        
        for (let ty = 0; ty < gridSize; ty++) {
            for (let tx = 0; tx < gridSize; tx++) {
                const px = startX + tx * tileSize;
                const py = startY + ty * tileSize;
                
                if (mx >= px && mx <= px + tileSize && my >= py && my <= py + tileSize) {
                    return ty * gridSize + tx;
                }
            }
        }
        return -1;
    }
    
    // Simon Says rendering
    renderSimonSays(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        const colors = puzzle.colors;
        const btnSize = 80;
        const spacing = 20;
        const startX = x + (w - (2 * btnSize + spacing)) / 2;
        const startY = y + 40;
        
        const positions = [
            { x: startX, y: startY },
            { x: startX + btnSize + spacing, y: startY },
            { x: startX, y: startY + btnSize + spacing },
            { x: startX + btnSize + spacing, y: startY + btnSize + spacing }
        ];
        
        for (let i = 0; i < 4; i++) {
            const pos = positions[i];
            const isActive = puzzle.activeButton === i;
            
            ctx.fillStyle = isActive ? colors[i] : this.darkenColor(colors[i], 0.4);
            ctx.shadowColor = isActive ? colors[i] : 'transparent';
            ctx.shadowBlur = isActive ? 20 : 0;
            
            ctx.beginPath();
            ctx.roundRect(pos.x, pos.y, btnSize, btnSize, 10);
            ctx.fill();
            
            ctx.shadowBlur = 0;
        }
        
        // Phase indicator
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        if (puzzle.phase === 'showing') {
            ctx.fillText('Watch the sequence...', x + w / 2, y + 20);
        } else {
            ctx.fillText('Repeat the sequence!', x + w / 2, y + 20);
            ctx.fillStyle = '#88ff88';
            ctx.fillText(`${puzzle.playerSequence.length} / ${puzzle.sequence.length}`, x + w / 2, startY + 2 * btnSize + spacing + 40);
        }
    }
    
    getSimonSaysClick(mx, my, x, y) {
        if (this.puzzle.phase !== 'input') return -1;
        
        const w = this.width - 40;
        const btnSize = 80;
        const spacing = 20;
        const startX = x + (w - (2 * btnSize + spacing)) / 2;
        const startY = y + 40;
        
        const positions = [
            { x: startX, y: startY },
            { x: startX + btnSize + spacing, y: startY },
            { x: startX, y: startY + btnSize + spacing },
            { x: startX + btnSize + spacing, y: startY + btnSize + spacing }
        ];
        
        for (let i = 0; i < 4; i++) {
            const pos = positions[i];
            if (mx >= pos.x && mx <= pos.x + btnSize && my >= pos.y && my <= pos.y + btnSize) {
                return i;
            }
        }
        return -1;
    }
    
    // Word Scramble rendering
    renderWordScramble(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        const centerX = x + w / 2;
        
        // Current guess
        ctx.fillStyle = '#88ff88';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(puzzle.currentGuess || '_'.repeat(puzzle.word.length), centerX, y + 50);
        
        // Scrambled letters
        const letterSize = 45;
        const spacing = 55;
        const letters = puzzle.letterPositions;
        const startX = centerX - (letters.length - 1) * spacing / 2;
        
        ctx.font = 'bold 28px Arial';
        for (let i = 0; i < letters.length; i++) {
            const lx = startX + i * spacing - letterSize / 2;
            const ly = y + 100;
            
            if (letters[i].selected) {
                ctx.fillStyle = '#1a1a2e';
            } else {
                ctx.fillStyle = this.hoverIndex === i ? '#5a5a9e' : '#3a3a5e';
            }
            
            ctx.beginPath();
            ctx.roundRect(lx, ly, letterSize, letterSize, 8);
            ctx.fill();
            
            ctx.fillStyle = letters[i].selected ? '#666' : '#fff';
            ctx.fillText(letters[i].letter, startX + i * spacing, ly + 33);
        }
        
        // Reset button
        const resetX = centerX - 50;
        const resetY = y + 180;
        ctx.fillStyle = this.hoverIndex === 999 ? '#884444' : '#663333';
        ctx.beginPath();
        ctx.roundRect(resetX, resetY, 100, 35, 5);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.fillText('Reset', centerX, resetY + 24);
    }
    
    getWordScrambleClick(mx, my, x, y) {
        const puzzle = this.puzzle;
        const w = this.width - 40;
        const centerX = x + w / 2;
        
        // Check reset button
        const resetX = centerX - 50;
        const resetY = y + 180;
        if (mx >= resetX && mx <= resetX + 100 && my >= resetY && my <= resetY + 35) {
            return 999;
        }
        
        // Check letters
        const letterSize = 45;
        const spacing = 55;
        const letters = puzzle.letterPositions;
        const startX = centerX - (letters.length - 1) * spacing / 2;
        
        for (let i = 0; i < letters.length; i++) {
            const lx = startX + i * spacing - letterSize / 2;
            const ly = y + 100;
            
            if (mx >= lx && mx <= lx + letterSize && my >= ly && my <= ly + letterSize) {
                return i;
            }
        }
        
        return -1;
    }
    
    // Lock Picking rendering
    renderLockPicking(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        const pinWidth = 40;
        const spacing = 55;
        const startX = x + (w - puzzle.pins.length * spacing) / 2;
        const baseY = y + 200;
        
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Click arrows to adjust pins until they lock', x + w / 2, y + 20);
        
        for (let i = 0; i < puzzle.pins.length; i++) {
            const pin = puzzle.pins[i];
            const px = startX + i * spacing;
            
            // Pin slot
            ctx.fillStyle = '#222';
            ctx.fillRect(px, y + 50, pinWidth, 150);
            
            // Pin
            const pinHeight = 20 + pin.currentHeight * 20;
            ctx.fillStyle = pin.locked ? '#44ff44' : '#888';
            ctx.fillRect(px + 5, baseY - pinHeight, pinWidth - 10, pinHeight);
            
            // Lock indicator
            if (pin.locked) {
                ctx.fillStyle = '#44ff44';
                ctx.font = '20px Arial';
                ctx.fillText('✓', px + pinWidth / 2, baseY + 25);
            }
            
            // Up/Down arrows
            ctx.fillStyle = pin.locked ? '#333' : '#4a4a8e';
            ctx.beginPath();
            ctx.moveTo(px + pinWidth / 2, y + 40);
            ctx.lineTo(px + 5, y + 55);
            ctx.lineTo(px + pinWidth - 5, y + 55);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(px + pinWidth / 2, baseY + 50);
            ctx.lineTo(px + 5, baseY + 35);
            ctx.lineTo(px + pinWidth - 5, baseY + 35);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    getLockPickingClick(mx, my, x, y) {
        const puzzle = this.puzzle;
        const pinWidth = 40;
        const spacing = 55;
        const w = this.width - 40;
        const startX = x + (w - puzzle.pins.length * spacing) / 2;
        const baseY = y + 200;
        
        for (let i = 0; i < puzzle.pins.length; i++) {
            const px = startX + i * spacing;
            
            // Up arrow
            if (mx >= px && mx <= px + pinWidth && my >= y + 35 && my <= y + 60) {
                return i * 2; // Up
            }
            // Down arrow
            if (mx >= px && mx <= px + pinWidth && my >= baseY + 30 && my <= baseY + 55) {
                return i * 2 + 1; // Down
            }
        }
        return -1;
    }
    
    // Constellation rendering
    renderConstellation(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        
        // Draw faint hint lines
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        for (const line of puzzle.hintLines) {
            ctx.beginPath();
            ctx.moveTo(x + line.x1, y + line.y1);
            ctx.lineTo(x + line.x2, y + line.y2);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        
        // Draw player connections
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 3;
        for (const conn of puzzle.connections) {
            const from = puzzle.stars[conn.from];
            const to = puzzle.stars[conn.to];
            ctx.beginPath();
            ctx.moveTo(x + from.x, y + from.y);
            ctx.lineTo(x + to.x, y + to.y);
            ctx.stroke();
        }
        
        // Draw stars
        for (let i = 0; i < puzzle.stars.length; i++) {
            const star = puzzle.stars[i];
            const isFirst = puzzle.correctOrder[0] === i;
            
            ctx.fillStyle = star.selected ? '#ffcc00' : (isFirst ? '#88ff88' : '#fff');
            ctx.shadowColor = star.selected ? '#ffcc00' : '#fff';
            ctx.shadowBlur = 10;
            
            ctx.beginPath();
            ctx.arc(x + star.x, y + star.y, star.selected ? 10 : 8, 0, Math.PI * 2);
            ctx.fill();
            
            if (isFirst && !star.selected) {
                ctx.font = '12px Arial';
                ctx.fillStyle = '#88ff88';
                ctx.textAlign = 'center';
                ctx.fillText('START', x + star.x, y + star.y + 25);
            }
        }
        ctx.shadowBlur = 0;
    }
    
    getConstellationClick(mx, my, x, y) {
        const puzzle = this.puzzle;
        
        for (let i = 0; i < puzzle.stars.length; i++) {
            const star = puzzle.stars[i];
            const dist = Math.hypot(mx - (x + star.x), my - (y + star.y));
            if (dist < 15) {
                return i;
            }
        }
        return -1;
    }
    
    // Rune Matching rendering
    renderRuneMatching(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        const cardSize = 50;
        const cols = 4;
        const spacing = 60;
        const startX = x + (w - cols * spacing) / 2;
        const startY = y + 20;
        
        for (let i = 0; i < puzzle.cards.length; i++) {
            const card = puzzle.cards[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = startX + col * spacing;
            const cy = startY + row * spacing;
            
            if (card.matched) {
                ctx.fillStyle = '#2a4a2e';
            } else if (card.flipped) {
                ctx.fillStyle = '#4a4a8e';
            } else {
                ctx.fillStyle = '#3a3a5e';
            }
            
            ctx.beginPath();
            ctx.roundRect(cx, cy, cardSize, cardSize, 5);
            ctx.fill();
            
            if (card.flipped || card.matched) {
                ctx.fillStyle = card.matched ? '#88ff88' : '#fff';
                ctx.font = '28px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(card.rune, cx + cardSize / 2, cy + 36);
            } else {
                ctx.fillStyle = '#666';
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('?', cx + cardSize / 2, cy + 35);
            }
        }
        
        // Progress
        ctx.fillStyle = '#88ff88';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Pairs found: ${puzzle.matchedPairs} / ${puzzle.pairCount}`, x + w / 2, startY + Math.ceil(puzzle.cards.length / cols) * spacing + 20);
    }
    
    getRuneMatchingClick(mx, my, x, y) {
        const puzzle = this.puzzle;
        const cardSize = 50;
        const cols = 4;
        const spacing = 60;
        const w = this.width - 40;
        const startX = x + (w - cols * spacing) / 2;
        const startY = y + 20;
        
        for (let i = 0; i < puzzle.cards.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = startX + col * spacing;
            const cy = startY + row * spacing;
            
            if (mx >= cx && mx <= cx + cardSize && my >= cy && my <= cy + cardSize) {
                return i;
            }
        }
        return -1;
    }
    
    // Pressure Plates rendering
    renderPressurePlates(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        const plateSize = 60;
        const cols = 4;
        const spacing = 75;
        const startX = x + (w - Math.min(cols, puzzle.plates.length) * spacing) / 2;
        const startY = y + 50;
        
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press from lightest to heaviest', x + w / 2, y + 20);
        
        for (let i = 0; i < puzzle.plates.length; i++) {
            const plate = puzzle.plates[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const px = startX + col * spacing;
            const py = startY + row * spacing;
            
            ctx.fillStyle = plate.pressed ? '#2a4a2e' : '#3a3a5e';
            ctx.strokeStyle = plate.pressed ? '#44ff44' : '#666';
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.roundRect(px, py, plateSize, plateSize, 8);
            ctx.fill();
            ctx.stroke();
            
            // Weight symbol
            ctx.fillStyle = plate.pressed ? '#88ff88' : '#fff';
            ctx.font = '32px Arial';
            ctx.fillText(plate.symbol, px + plateSize / 2, py + 42);
        }
    }
    
    getPressurePlatesClick(mx, my, x, y) {
        const puzzle = this.puzzle;
        const plateSize = 60;
        const cols = 4;
        const spacing = 75;
        const w = this.width - 40;
        const startX = x + (w - Math.min(cols, puzzle.plates.length) * spacing) / 2;
        const startY = y + 50;
        
        for (let i = 0; i < puzzle.plates.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const px = startX + col * spacing;
            const py = startY + row * spacing;
            
            if (mx >= px && mx <= px + plateSize && my >= py && my <= py + plateSize) {
                return i;
            }
        }
        return -1;
    }
    
    // Shadow Alignment rendering
    renderShadowAlignment(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        
        // Target shape preview
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Create a ${puzzle.targetShape} shadow`, x + w / 2, y + 20);
        
        // Draw objects
        for (let i = 0; i < puzzle.objects.length; i++) {
            const obj = puzzle.objects[i];
            const ox = x + obj.x;
            const oy = y + obj.y;
            
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(obj.rotation * Math.PI / 180);
            
            // Object
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.moveTo(0, -25);
            ctx.lineTo(15, 10);
            ctx.lineTo(-15, 10);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
            
            // Rotation indicator
            ctx.fillStyle = '#888';
            ctx.font = '12px Arial';
            ctx.fillText(`${obj.rotation}°`, ox, oy + 50);
        }
        
        // Shadow area (visual feedback)
        const allCorrect = puzzle.objects.every(o => o.rotation === o.correctRotation);
        ctx.fillStyle = allCorrect ? 'rgba(68, 255, 68, 0.3)' : 'rgba(100, 100, 100, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + 220, 80, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#666';
        ctx.font = '14px Arial';
        ctx.fillText('Shadow Zone', x + w / 2, y + 260);
    }
    
    getShadowAlignmentClick(mx, my, x, y) {
        const puzzle = this.puzzle;
        
        for (let i = 0; i < puzzle.objects.length; i++) {
            const obj = puzzle.objects[i];
            const ox = x + obj.x;
            const oy = y + obj.y;
            
            const dist = Math.hypot(mx - ox, my - oy);
            if (dist < 30) {
                return i;
            }
        }
        return -1;
    }
    
    // Elemental Balance rendering
    renderElementalBalance(ctx, x, y, w, h) {
        const puzzle = this.puzzle;
        const vesselWidth = 70;
        const spacing = 85;
        const startX = x + (w - puzzle.vessels.length * spacing) / 2;
        const startY = y + 60;
        
        // Inventory
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Inventory:', x + w / 2, y + 20);
        
        const elements = [
            { key: 'fire', symbol: 'F' },
            { key: 'water', symbol: 'W' },
            { key: 'earth', symbol: 'E' },
            { key: 'air', symbol: 'A' }
        ];
        
        ctx.font = '20px Arial';
        let invX = x + 100;
        for (const el of elements) {
            ctx.fillText(`${el.symbol}${puzzle.inventory[el.key]}`, invX, y + 45);
            invX += 100;
        }
        
        // Vessels
        for (let i = 0; i < puzzle.vessels.length; i++) {
            const vessel = puzzle.vessels[i];
            const vx = startX + i * spacing;
            
            // Vessel container
            ctx.fillStyle = '#2a2a4e';
            ctx.strokeStyle = '#4a4a6e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(vx, startY, vesselWidth, 120, 5);
            ctx.fill();
            ctx.stroke();
            
            // Target indicators (faint)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '12px Arial';
            let ty = startY + 15;
            for (const el of elements) {
                if (vessel.target[el.key] > 0) {
                    ctx.fillText(`${el.symbol}${vessel.target[el.key]}`, vx + vesselWidth / 2, ty);
                    ty += 18;
                }
            }
            
            // Current contents
            ctx.fillStyle = '#fff';
            ty = startY + 70;
            for (const el of elements) {
                if (vessel.current[el.key] > 0) {
                    ctx.fillText(`${el.symbol}${vessel.current[el.key]}`, vx + vesselWidth / 2, ty);
                    ty += 18;
                }
            }
            
            // Add buttons below vessel
            const btnY = startY + 125;
            const btnSize = 15;
            for (let e = 0; e < 4; e++) {
                const btnX = vx + e * 18;
                ctx.fillStyle = puzzle.inventory[elements[e].key] > 0 ? '#3a5a3e' : '#333';
                ctx.fillRect(btnX, btnY, btnSize, btnSize);
                ctx.font = '10px Arial';
                ctx.fillText(elements[e].symbol, btnX + 7, btnY + 12);
            }
        }
    }
    
    getElementalBalanceClick(mx, my, x, y) {
        const puzzle = this.puzzle;
        const vesselWidth = 70;
        const spacing = 85;
        const w = this.width - 40;
        const startX = x + (w - puzzle.vessels.length * spacing) / 2;
        const startY = y + 60;
        
        for (let i = 0; i < puzzle.vessels.length; i++) {
            const vx = startX + i * spacing;
            const btnY = startY + 125;
            const btnSize = 15;
            
            for (let e = 0; e < 4; e++) {
                const btnX = vx + e * 18;
                if (mx >= btnX && mx <= btnX + btnSize && my >= btnY && my <= btnY + btnSize) {
                    return i * 4 + e;
                }
            }
        }
        return -1;
    }
    
    // Utility
    darkenColor(hex, factor) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.floor((num >> 16) * factor);
        const g = Math.floor(((num >> 8) & 0x00FF) * factor);
        const b = Math.floor((num & 0x0000FF) * factor);
        return `rgb(${r}, ${g}, ${b})`;
    }
}

export default PuzzleUI;
