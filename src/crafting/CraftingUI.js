// Crafting UI - 9x9 Grid Interface
import { CraftingManager, CraftingMaterials, CraftingRecipes } from './CraftingSystem.js';

export class CraftingUI {
    constructor(canvas, character) {
        this.canvas = canvas;
        this.character = character;
        this.visible = false;
        this.craftingManager = new CraftingManager();
        
        // Grid settings
        this.gridSize = 9;
        this.cellSize = 40;
        this.gridPadding = 10;
        
        // UI state
        this.hoveredCell = { row: -1, col: -1 };
        this.selectedItem = null;
        this.selectedItemIndex = -1;
        this.craftResult = null;
        
        // Panels
        this.panelWidth = 500;
        this.panelHeight = 550;
        
        // Recipe book
        this.recipeBookOpen = false;
        this.recipeBookPage = 0;
        this.recipesPerPage = 6;
        this.selectedRecipe = null;
        
        // Animation
        this.craftAnimTimer = 0;
        this.craftAnimating = false;
        this.particles = [];
    }
    
    show() {
        this.visible = true;
        this.updateCraftResult();
    }
    
    hide() {
        this.visible = false;
        this.returnItemsToInventory();
    }
    
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    // Return all items in the grid back to inventory
    returnItemsToInventory() {
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                const item = this.craftingManager.getItem(i, j);
                if (item) {
                    // Add back to inventory
                    for (let q = 0; q < item.quantity; q++) {
                        this.character.addToInventory({ ...item.item });
                    }
                }
            }
        }
        this.craftingManager.clearGrid();
    }
    
    handleClick(x, y) {
        if (!this.visible) return false;
        
        const panelX = this.canvas.width / 2 - this.panelWidth / 2;
        const panelY = this.canvas.height / 2 - this.panelHeight / 2;
        
        // Check recipe book toggle
        const bookBtnX = panelX + this.panelWidth - 100;
        const bookBtnY = panelY + 10;
        if (x >= bookBtnX && x <= bookBtnX + 80 &&
            y >= bookBtnY && y <= bookBtnY + 25) {
            this.recipeBookOpen = !this.recipeBookOpen;
            return true;
        }
        
        // If recipe book is open, handle that
        if (this.recipeBookOpen) {
            return this.handleRecipeBookClick(x, y);
        }
        
        // Check craft button
        const craftBtnX = panelX + this.panelWidth / 2 - 50;
        const craftBtnY = panelY + this.panelHeight - 70;
        if (x >= craftBtnX && x <= craftBtnX + 100 &&
            y >= craftBtnY && y <= craftBtnY + 35) {
            this.attemptCraft();
            return true;
        }
        
        // Check clear button
        const clearBtnX = panelX + this.panelWidth / 2 + 60;
        const clearBtnY = panelY + this.panelHeight - 70;
        if (x >= clearBtnX && x <= clearBtnX + 80 &&
            y >= clearBtnY && y <= clearBtnY + 35) {
            this.returnItemsToInventory();
            this.updateCraftResult();
            return true;
        }
        
        // Check crafting grid clicks
        const gridX = panelX + 20;
        const gridY = panelY + 60;
        const gridWidth = this.gridSize * this.cellSize;
        
        if (x >= gridX && x < gridX + gridWidth &&
            y >= gridY && y < gridY + gridWidth) {
            const col = Math.floor((x - gridX) / this.cellSize);
            const row = Math.floor((y - gridY) / this.cellSize);
            
            // If we have a selected item, place it
            if (this.selectedItem) {
                this.placeSelectedItem(row, col);
            } else {
                // Pick up item from grid
                const item = this.craftingManager.removeItem(row, col);
                if (item) {
                    this.selectedItem = item.item;
                    // Add back to inventory
                    for (let q = 0; q < item.quantity; q++) {
                        this.character.addToInventory({ ...item.item });
                    }
                }
            }
            this.updateCraftResult();
            return true;
        }
        
        // Check inventory grid clicks
        const invGridX = panelX + 20;
        const invGridY = panelY + this.panelHeight - 180;
        const invCols = 10;
        const invRows = 3;
        const invCellSize = 35;
        
        if (x >= invGridX && x < invGridX + invCols * invCellSize &&
            y >= invGridY && y < invGridY + invRows * invCellSize) {
            const col = Math.floor((x - invGridX) / invCellSize);
            const row = Math.floor((y - invGridY) / invCellSize);
            const index = row * invCols + col;
            
            if (index < this.character.inventory.length) {
                const item = this.character.inventory[index];
                if (item && item.type === 'material' || item?.stackable) {
                    // Select item from inventory
                    this.selectedItem = item;
                    this.selectedItemIndex = index;
                }
            }
            return true;
        }
        
        // Deselect if clicking elsewhere
        this.selectedItem = null;
        this.selectedItemIndex = -1;
        
        return false;
    }
    
    handleRecipeBookClick(x, y) {
        const bookX = this.canvas.width / 2 - 200;
        const bookY = 100;
        const bookW = 400;
        const bookH = 400;
        
        // Close button
        if (x >= bookX + bookW - 30 && x <= bookX + bookW - 10 &&
            y >= bookY + 10 && y <= bookY + 30) {
            this.recipeBookOpen = false;
            return true;
        }
        
        // Previous page
        if (x >= bookX + 20 && x <= bookX + 60 &&
            y >= bookY + bookH - 40 && y <= bookY + bookH - 10) {
            if (this.recipeBookPage > 0) this.recipeBookPage--;
            return true;
        }
        
        // Next page
        const allRecipes = this.craftingManager.getAllRecipes();
        const maxPages = Math.ceil(allRecipes.length / this.recipesPerPage);
        if (x >= bookX + bookW - 60 && x <= bookX + bookW - 20 &&
            y >= bookY + bookH - 40 && y <= bookY + bookH - 10) {
            if (this.recipeBookPage < maxPages - 1) this.recipeBookPage++;
            return true;
        }
        
        // Recipe selection
        const startY = bookY + 60;
        const recipeHeight = 50;
        const startIdx = this.recipeBookPage * this.recipesPerPage;
        const endIdx = Math.min(startIdx + this.recipesPerPage, allRecipes.length);
        
        for (let i = startIdx; i < endIdx; i++) {
            const y1 = startY + (i - startIdx) * recipeHeight;
            if (y >= y1 && y <= y1 + recipeHeight - 5 &&
                x >= bookX + 20 && x <= bookX + bookW - 20) {
                this.selectedRecipe = allRecipes[i];
                return true;
            }
        }
        
        return true;
    }
    
    placeSelectedItem(row, col) {
        if (!this.selectedItem) return;
        
        // Find and remove from inventory
        const invIndex = this.character.inventory.findIndex(
            item => item && item.id === this.selectedItem.id
        );
        
        if (invIndex !== -1) {
            const item = this.character.inventory[invIndex];
            this.character.inventory.splice(invIndex, 1);
            
            // Place in crafting grid
            this.craftingManager.placeItem(row, col, item, 1);
        }
        
        // Deselect
        this.selectedItem = null;
        this.selectedItemIndex = -1;
    }
    
    handleHover(x, y) {
        if (!this.visible) return;
        
        const panelX = this.canvas.width / 2 - this.panelWidth / 2;
        const panelY = this.canvas.height / 2 - this.panelHeight / 2;
        
        // Check crafting grid
        const gridX = panelX + 20;
        const gridY = panelY + 60;
        const gridWidth = this.gridSize * this.cellSize;
        
        if (x >= gridX && x < gridX + gridWidth &&
            y >= gridY && y < gridY + gridWidth) {
            this.hoveredCell = {
                row: Math.floor((y - gridY) / this.cellSize),
                col: Math.floor((x - gridX) / this.cellSize)
            };
        } else {
            this.hoveredCell = { row: -1, col: -1 };
        }
    }
    
    updateCraftResult() {
        this.craftResult = this.craftingManager.findMatchingRecipe();
    }
    
    attemptCraft() {
        if (!this.craftResult) return;
        
        // Start craft animation
        this.craftAnimating = true;
        this.craftAnimTimer = 0;
        
        // Create particles
        const panelX = this.canvas.width / 2 - this.panelWidth / 2;
        const panelY = this.canvas.height / 2 - this.panelHeight / 2;
        const centerX = panelX + 20 + (this.gridSize * this.cellSize) / 2;
        const centerY = panelY + 60 + (this.gridSize * this.cellSize) / 2;
        
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: centerX + (Math.random() - 0.5) * 100,
                y: centerY + (Math.random() - 0.5) * 100,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200 - 100,
                life: 1.0,
                color: this.craftResult.result.color || '#ffaa00'
            });
        }
        
        // Perform craft
        const result = this.craftingManager.craft();
        if (result) {
            for (let i = 0; i < result.quantity; i++) {
                this.character.addToInventory({ ...result.item });
            }
        }
        
        this.updateCraftResult();
    }
    
    update(dt) {
        if (!this.visible) return;
        
        // Update craft animation
        if (this.craftAnimating) {
            this.craftAnimTimer += dt;
            if (this.craftAnimTimer > 0.5) {
                this.craftAnimating = false;
            }
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 300 * dt; // Gravity
            p.life -= dt * 2;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    render(ctx) {
        if (!this.visible) return;
        
        // Darkened background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const panelX = this.canvas.width / 2 - this.panelWidth / 2;
        const panelY = this.canvas.height / 2 - this.panelHeight / 2;
        
        // Main panel background (parchment style)
        this.renderParchmentPanel(ctx, panelX, panelY, this.panelWidth, this.panelHeight);
        
        // Title
        ctx.fillStyle = '#3a2a1a';
        ctx.font = 'bold 24px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Crafting', panelX + this.panelWidth / 2, panelY + 35);
        
        // Recipe book button
        ctx.fillStyle = this.recipeBookOpen ? '#8b6914' : '#a8946c';
        ctx.fillRect(panelX + this.panelWidth - 100, panelY + 10, 80, 25);
        ctx.strokeStyle = '#6b5344';
        ctx.strokeRect(panelX + this.panelWidth - 100, panelY + 10, 80, 25);
        ctx.fillStyle = '#2a1a0a';
        ctx.font = '12px Georgia';
        ctx.fillText('Recipes', panelX + this.panelWidth - 60, panelY + 27);
        
        // Render crafting grid
        this.renderCraftingGrid(ctx, panelX + 20, panelY + 60);
        
        // Render result preview
        this.renderResultPreview(ctx, panelX + this.panelWidth - 120, panelY + 200);
        
        // Render inventory section
        this.renderInventorySection(ctx, panelX + 20, panelY + this.panelHeight - 180);
        
        // Craft button
        const craftBtnX = panelX + this.panelWidth / 2 - 50;
        const craftBtnY = panelY + this.panelHeight - 70;
        ctx.fillStyle = this.craftResult ? '#4a7a4a' : '#666666';
        ctx.fillRect(craftBtnX, craftBtnY, 100, 35);
        ctx.strokeStyle = '#2a4a2a';
        ctx.lineWidth = 2;
        ctx.strokeRect(craftBtnX, craftBtnY, 100, 35);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Georgia';
        ctx.fillText('CRAFT', craftBtnX + 50, craftBtnY + 24);
        
        // Clear button
        const clearBtnX = panelX + this.panelWidth / 2 + 60;
        ctx.fillStyle = '#7a4a4a';
        ctx.fillRect(clearBtnX, craftBtnY, 80, 35);
        ctx.strokeStyle = '#4a2a2a';
        ctx.strokeRect(clearBtnX, craftBtnY, 80, 35);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('CLEAR', clearBtnX + 40, craftBtnY + 24);
        
        // Close hint
        ctx.fillStyle = '#5a4a3a';
        ctx.font = '12px Georgia';
        ctx.fillText('Press C to close', panelX + this.panelWidth / 2, panelY + this.panelHeight - 15);
        
        // Render particles
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        // Render selected item following cursor
        if (this.selectedItem) {
            const mouse = { x: this.hoveredCell.col * this.cellSize, y: this.hoveredCell.row * this.cellSize };
            ctx.fillStyle = this.selectedItem.color || '#888888';
            ctx.globalAlpha = 0.7;
            // This would need actual mouse coordinates passed in
        }
        
        // Recipe book overlay
        if (this.recipeBookOpen) {
            this.renderRecipeBook(ctx);
        }
        
        ctx.textAlign = 'left';
    }
    
    renderParchmentPanel(ctx, x, y, w, h) {
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(x + 6, y + 6, w, h, 5);
        ctx.fill();
        
        // Main panel
        const gradient = ctx.createLinearGradient(x, y, x + w, y);
        gradient.addColorStop(0, '#c4b498');
        gradient.addColorStop(0.5, '#d8ccb8');
        gradient.addColorStop(1, '#c4b498');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 5);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = '#6b5344';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 5);
        ctx.stroke();
    }
    
    renderCraftingGrid(ctx, startX, startY) {
        ctx.font = '12px Georgia';
        ctx.fillStyle = '#4a3a2a';
        ctx.textAlign = 'left';
        ctx.fillText('Crafting Grid (9x9)', startX, startY - 5);
        
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = startX + col * this.cellSize;
                const y = startY + row * this.cellSize;
                
                // Cell background
                const isHovered = row === this.hoveredCell.row && col === this.hoveredCell.col;
                ctx.fillStyle = isHovered ? '#b4a888' : '#a8a090';
                ctx.fillRect(x, y, this.cellSize - 2, this.cellSize - 2);
                
                // Cell border
                ctx.strokeStyle = isHovered ? '#3a2a1a' : '#6b5344';
                ctx.lineWidth = isHovered ? 2 : 1;
                ctx.strokeRect(x, y, this.cellSize - 2, this.cellSize - 2);
                
                // Item in cell
                const item = this.craftingManager.getItem(row, col);
                if (item) {
                    ctx.fillStyle = item.item.color || '#888888';
                    ctx.fillRect(x + 4, y + 4, this.cellSize - 10, this.cellSize - 10);
                    
                    // Quantity
                    if (item.quantity > 1) {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 10px Arial';
                        ctx.textAlign = 'right';
                        ctx.fillText(item.quantity.toString(), x + this.cellSize - 6, y + this.cellSize - 6);
                    }
                }
            }
        }
    }
    
    renderResultPreview(ctx, x, y) {
        ctx.font = '12px Georgia';
        ctx.fillStyle = '#4a3a2a';
        ctx.textAlign = 'center';
        ctx.fillText('Result', x + 40, y - 10);
        
        // Result box
        const boxSize = 80;
        ctx.fillStyle = this.craftResult ? '#c4b898' : '#888888';
        ctx.fillRect(x, y, boxSize, boxSize);
        ctx.strokeStyle = '#6b5344';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, boxSize, boxSize);
        
        if (this.craftResult) {
            // Show result item
            ctx.fillStyle = this.craftResult.result.color || '#ffaa00';
            ctx.fillRect(x + 10, y + 10, boxSize - 20, boxSize - 20);
            
            // Result name
            ctx.fillStyle = '#2a1a0a';
            ctx.font = '10px Georgia';
            ctx.fillText(this.craftResult.name, x + boxSize / 2, y + boxSize + 15);
            
            // Quantity
            if (this.craftResult.quantity > 1) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px Arial';
                ctx.fillText('x' + this.craftResult.quantity, x + boxSize / 2, y + boxSize - 5);
            }
        } else {
            ctx.fillStyle = '#666666';
            ctx.font = '10px Georgia';
            ctx.fillText('No Recipe', x + boxSize / 2, y + boxSize / 2 + 5);
        }
    }
    
    renderInventorySection(ctx, startX, startY) {
        ctx.font = '12px Georgia';
        ctx.fillStyle = '#4a3a2a';
        ctx.textAlign = 'left';
        ctx.fillText('Inventory (click to select material)', startX, startY - 5);
        
        const invCols = 10;
        const invRows = 3;
        const cellSize = 35;
        
        for (let i = 0; i < invCols * invRows; i++) {
            const row = Math.floor(i / invCols);
            const col = i % invCols;
            const x = startX + col * cellSize;
            const y = startY + row * cellSize;
            
            const item = this.character.inventory[i];
            
            // Cell background
            ctx.fillStyle = item ? '#b4a888' : '#a8a090';
            ctx.fillRect(x, y, cellSize - 2, cellSize - 2);
            
            // Border
            ctx.strokeStyle = '#6b5344';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellSize - 2, cellSize - 2);
            
            // Item
            if (item) {
                ctx.fillStyle = item.color || '#888888';
                ctx.fillRect(x + 3, y + 3, cellSize - 8, cellSize - 8);
                
                // Quantity
                if (item.quantity && item.quantity > 1) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 9px Arial';
                    ctx.textAlign = 'right';
                    ctx.fillText(item.quantity.toString(), x + cellSize - 5, y + cellSize - 5);
                }
            }
        }
    }
    
    renderRecipeBook(ctx) {
        const bookX = this.canvas.width / 2 - 200;
        const bookY = 100;
        const bookW = 400;
        const bookH = 400;
        
        // Book background
        this.renderParchmentPanel(ctx, bookX, bookY, bookW, bookH);
        
        // Title
        ctx.fillStyle = '#3a2a1a';
        ctx.font = 'bold 20px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Recipe Book', bookX + bookW / 2, bookY + 35);
        
        // Close button
        ctx.fillStyle = '#7a4a4a';
        ctx.fillRect(bookX + bookW - 30, bookY + 10, 20, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('X', bookX + bookW - 20, bookY + 25);
        
        // Recipe list
        const allRecipes = this.craftingManager.getAllRecipes();
        const startIdx = this.recipeBookPage * this.recipesPerPage;
        const endIdx = Math.min(startIdx + this.recipesPerPage, allRecipes.length);
        
        const startY = bookY + 60;
        const recipeHeight = 50;
        
        for (let i = startIdx; i < endIdx; i++) {
            const recipe = allRecipes[i];
            const y = startY + (i - startIdx) * recipeHeight;
            
            // Recipe background
            const isSelected = this.selectedRecipe === recipe;
            ctx.fillStyle = isSelected ? '#d8c8a8' : '#c4b498';
            ctx.fillRect(bookX + 20, y, bookW - 40, recipeHeight - 5);
            ctx.strokeStyle = isSelected ? '#8b6914' : '#6b5344';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(bookX + 20, y, bookW - 40, recipeHeight - 5);
            
            // Recipe icon
            ctx.fillStyle = recipe.result.color || '#888888';
            ctx.fillRect(bookX + 30, y + 8, 30, 30);
            
            // Recipe name
            ctx.fillStyle = '#2a1a0a';
            ctx.font = 'bold 14px Georgia';
            ctx.textAlign = 'left';
            ctx.fillText(recipe.name, bookX + 70, y + 20);
            
            // Recipe type
            ctx.font = '11px Georgia';
            ctx.fillStyle = '#5a4a3a';
            ctx.fillText(`Type: ${recipe.type}`, bookX + 70, y + 35);
            
            // Craftable indicator
            const canCraft = this.craftingManager.canCraftRecipe(recipe, this.character.inventory);
            ctx.fillStyle = canCraft ? '#4a7a4a' : '#7a4a4a';
            ctx.font = '10px Georgia';
            ctx.textAlign = 'right';
            ctx.fillText(canCraft ? '✓ Can Craft' : '✗ Missing Materials', bookX + bookW - 30, y + 25);
        }
        
        // Selected recipe details
        if (this.selectedRecipe) {
            const detailY = bookY + 320;
            ctx.fillStyle = '#4a3a2a';
            ctx.font = '12px Georgia';
            ctx.textAlign = 'left';
            ctx.fillText('Ingredients:', bookX + 30, detailY);
            
            let ingredientY = detailY + 15;
            if (this.selectedRecipe.shaped) {
                const needed = {};
                for (const row of this.selectedRecipe.pattern) {
                    for (const cell of row) {
                        if (cell !== 'X') {
                            needed[cell] = (needed[cell] || 0) + 1;
                        }
                    }
                }
                ctx.font = '11px Georgia';
                let x = bookX + 40;
                for (const [id, count] of Object.entries(needed)) {
                    ctx.fillText(`${id} x${count}`, x, ingredientY);
                    x += 100;
                    if (x > bookX + bookW - 50) {
                        x = bookX + 40;
                        ingredientY += 12;
                    }
                }
            } else {
                ctx.font = '11px Georgia';
                let x = bookX + 40;
                for (const [id, count] of Object.entries(this.selectedRecipe.ingredients)) {
                    ctx.fillText(`${id} x${count}`, x, ingredientY);
                    x += 100;
                    if (x > bookX + bookW - 50) {
                        x = bookX + 40;
                        ingredientY += 12;
                    }
                }
            }
        }
        
        // Navigation buttons
        const maxPages = Math.ceil(allRecipes.length / this.recipesPerPage);
        
        // Previous
        ctx.fillStyle = this.recipeBookPage > 0 ? '#8b6914' : '#888888';
        ctx.fillRect(bookX + 20, bookY + bookH - 40, 40, 25);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('<', bookX + 40, bookY + bookH - 22);
        
        // Next
        ctx.fillStyle = this.recipeBookPage < maxPages - 1 ? '#8b6914' : '#888888';
        ctx.fillRect(bookX + bookW - 60, bookY + bookH - 40, 40, 25);
        ctx.fillText('>', bookX + bookW - 40, bookY + bookH - 22);
        
        // Page number
        ctx.fillStyle = '#4a3a2a';
        ctx.font = '12px Georgia';
        ctx.fillText(`Page ${this.recipeBookPage + 1} / ${maxPages}`, bookX + bookW / 2, bookY + bookH - 22);
    }
}

export default CraftingUI;
