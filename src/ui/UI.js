/**
 * UI System - HUD, Menus, and Interface elements
 */

export class UIManager {
    constructor(ctx, canvas) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.elements = [];
        this.activePanel = null;
        this.notifications = [];
        this.damageNumbers = [];
    }
    
    // Add floating damage number
    addDamageNumber(x, y, damage, isCrit = false, isHeal = false) {
        this.damageNumbers.push({
            x, y,
            startY: y,
            text: Math.floor(damage).toString(),
            color: isHeal ? '#44ff44' : (isCrit ? '#ffff00' : '#ff4444'),
            scale: isCrit ? 1.5 : 1,
            alpha: 1,
            lifetime: 1
        });
    }
    
    // Add notification message
    addNotification(message, type = 'info') {
        const colors = {
            info: '#ffffff',
            success: '#44ff44',
            warning: '#ffff00',
            error: '#ff4444',
            levelup: '#ffaa00'
        };
        
        this.notifications.push({
            text: message,
            color: colors[type] || colors.info,
            lifetime: 3,
            alpha: 1
        });
    }
    
    update(dt) {
        // Update damage numbers
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dmg = this.damageNumbers[i];
            dmg.y -= 50 * dt;
            dmg.lifetime -= dt;
            dmg.alpha = dmg.lifetime;
            
            if (dmg.lifetime <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }
        
        // Update notifications
        for (let i = this.notifications.length - 1; i >= 0; i--) {
            const notif = this.notifications[i];
            notif.lifetime -= dt;
            
            if (notif.lifetime < 0.5) {
                notif.alpha = notif.lifetime * 2;
            }
            
            if (notif.lifetime <= 0) {
                this.notifications.splice(i, 1);
            }
        }
    }
    
    render() {
        // Damage numbers are rendered in world space (handled separately)
    }
    
    renderWorldUI(ctx, camera) {
        // Render damage numbers in world space
        for (const dmg of this.damageNumbers) {
            ctx.save();
            ctx.globalAlpha = dmg.alpha;
            ctx.fillStyle = dmg.color;
            ctx.font = `bold ${Math.floor(16 * dmg.scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(dmg.text, dmg.x, dmg.y);
            ctx.restore();
        }
    }
    
    renderScreenUI(ctx) {
        // Render notifications at top of screen
        for (let i = 0; i < this.notifications.length; i++) {
            const notif = this.notifications[i];
            ctx.save();
            ctx.globalAlpha = notif.alpha;
            ctx.fillStyle = notif.color;
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(notif.text, this.canvas.width / 2, 100 + i * 30);
            ctx.restore();
        }
    }
}

// HUD - Heads up display
export class HUD {
    constructor(canvas) {
        this.canvas = canvas;
        this.player = null;
        this.dungeon = null;
        this.boss = null; // Current boss for big health bar
        this.bossBarAnimation = 0; // For pulsing effect
    }
    
    setPlayer(player) {
        this.player = player;
    }
    
    setDungeon(dungeon) {
        this.dungeon = dungeon;
    }
    
    setBoss(boss) {
        this.boss = boss;
    }
    
    render(ctx) {
        if (!this.player) return;
        
        // Update boss bar animation
        this.bossBarAnimation += 0.05;
        
        // Render big boss health bar if in boss fight
        if (this.boss && this.boss.active && this.boss.health > 0) {
            this.renderBossBar(ctx);
        }
        
        // Draw HUD background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 250, 100);
        
        // Health bar
        this.drawBar(ctx, 20, 20, 180, 20, 
            this.player.health / this.player.maxHealth,
            '#aa3333', '#551111', 
            `HP: ${Math.floor(this.player.health)}/${this.player.maxHealth}`
        );
        
        // Mana bar
        this.drawBar(ctx, 20, 45, 180, 16,
            this.player.mana / this.player.maxMana,
            '#3333aa', '#111155',
            `MP: ${Math.floor(this.player.mana)}/${this.player.maxMana}`
        );
        
        // Stamina bar
        this.drawBar(ctx, 20, 66, 180, 12,
            this.player.stamina / this.player.maxStamina,
            '#33aa33', '#115511',
            `SP: ${Math.floor(this.player.stamina)}/${this.player.maxStamina}`
        );
        
        // Experience bar
        this.drawBar(ctx, 20, 85, 180, 10,
            this.player.experience / this.player.experienceToLevel,
            '#aaaa33', '#555511',
            `XP: ${this.player.experience}/${this.player.experienceToLevel}`
        );
        
        // Level and class
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`Lv.${this.player.level} ${this.player.className}`, 210, 35);
        
        // Gold
        ctx.fillStyle = '#ffcc00';
        ctx.font = '12px Arial';
        ctx.fillText(`Gold: ${this.player.gold || 0}`, 210, 55);
        
        // Skill points
        if (this.player.skillPoints > 0) {
            ctx.fillStyle = '#00ff00';
            ctx.fillText(`SP: ${this.player.skillPoints}`, 210, 75);
        }
        
        // Multiclass indicator
        if (this.player.canMulticlass && !this.player.secondaryClass) {
            ctx.fillStyle = '#ffaa00';
            ctx.fillText('Multiclass Available!', 210, 95);
        } else if (this.player.secondaryClass) {
            ctx.fillStyle = '#aaaaff';
            ctx.font = '10px Arial';
            ctx.fillText(`+${this.player.secondaryClass}`, 210, 95);
        }
        
        // Potion counter
        this.renderPotionCounter(ctx);
        
        // Ability bar
        this.renderAbilityBar(ctx);
        
        // Minimap
        this.renderMinimap(ctx);
    }
    
    drawBar(ctx, x, y, width, height, percent, fillColor, bgColor, text) {
        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, width, height);
        
        // Fill
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, width * Math.max(0, Math.min(1, percent)), height);
        
        // Border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
        
        // Text
        if (text && height >= 12) {
            ctx.fillStyle = '#fff';
            ctx.font = `${height - 4}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(text, x + width / 2, y + height - 3);
            ctx.textAlign = 'left';
        }
    }
    
    renderAbilityBar(ctx) {
        const barY = this.canvas.height - 70;
        const barX = this.canvas.width / 2 - 200;
        const slotSize = 50;
        const padding = 5;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX - 10, barY - 10, 8 * (slotSize + padding) + 20, slotSize + 20);
        
        // Ability slots
        for (let i = 0; i < 8; i++) {
            const x = barX + i * (slotSize + padding);
            const ability = this.player.abilities[i];
            const cooldown = this.player.cooldowns.get(ability?.name) || 0;
            
            // Slot background
            ctx.fillStyle = ability ? '#333' : '#222';
            ctx.fillRect(x, barY, slotSize, slotSize);
            
            if (ability) {
                // Ability icon (placeholder)
                ctx.fillStyle = this.getAbilityColor(ability);
                ctx.fillRect(x + 5, barY + 5, slotSize - 10, slotSize - 10);
                
                // Cooldown overlay
                if (cooldown > 0) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(x, barY, slotSize, slotSize);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(cooldown.toFixed(1), x + slotSize/2, barY + slotSize/2 + 6);
                }
                
                // Ability name
                ctx.fillStyle = '#fff';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(ability.name.substring(0, 8), x + slotSize/2, barY + slotSize - 2);
            }
            
            // Key binding
            ctx.fillStyle = '#888';
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(i + 1, x + 2, barY + 12);
            
            // Border
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, barY, slotSize, slotSize);
        }
        
        ctx.textAlign = 'left';
    }
    
    getAbilityColor(ability) {
        if (!ability) return '#333';
        
        const colors = {
            fire: '#ff6600',
            ice: '#66ccff',
            lightning: '#ffff00',
            dark: '#6600aa',
            holy: '#ffffaa',
            physical: '#aa6633',
            arcane: '#aa66ff'
        };
        
        return colors[ability.element] || '#666';
    }
    
    renderMinimap(ctx) {
        // Minimap in top-right corner
        const mapSize = 150;
        const x = this.canvas.width - mapSize - 10;
        const y = 10;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, mapSize, mapSize);
        
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, mapSize, mapSize);
        
        // Render actual minimap content if dungeon data is available
        if (this.dungeon && this.player) {
            const dungeonWidth = this.dungeon.width;
            const dungeonHeight = this.dungeon.height;
            const tileSize = Math.min(mapSize / dungeonWidth, mapSize / dungeonHeight);
            const offsetX = x + (mapSize - dungeonWidth * tileSize) / 2;
            const offsetY = y + (mapSize - dungeonHeight * tileSize) / 2;
            
            // Draw tiles
            for (let ty = 0; ty < dungeonHeight; ty++) {
                for (let tx = 0; tx < dungeonWidth; tx++) {
                    const key = `${tx},${ty}`;
                    if (this.dungeon.discoveredTiles && this.dungeon.discoveredTiles.has(key)) {
                        const tile = this.dungeon.tiles[ty][tx];
                        const drawX = offsetX + tx * tileSize;
                        const drawY = offsetY + ty * tileSize;
                        
                        // Color based on tile type
                        if (tile === 0) { // VOID
                            continue;
                        } else if (tile === 1) { // WALL
                            ctx.fillStyle = '#444';
                        } else if (tile === 2) { // FLOOR
                            ctx.fillStyle = '#666';
                        } else if (tile === 12) { // DUNGEON_CORE
                            ctx.fillStyle = '#ff4400';
                        } else if (tile === 4 || tile === 5) { // STAIRS
                            ctx.fillStyle = '#44ff44';
                        } else if (tile === 6) { // CHEST
                            ctx.fillStyle = '#ffcc00';
                        } else if (tile === 10 || tile === 11) { // TORCH
                            ctx.fillStyle = '#ff8800';
                        } else {
                            ctx.fillStyle = '#555';
                        }
                        
                        ctx.fillRect(drawX, drawY, tileSize + 0.5, tileSize + 0.5);
                    }
                }
            }
            
            // Draw player position
            const playerTileX = Math.floor(this.player.x / 32);
            const playerTileY = Math.floor(this.player.y / 32);
            const wrappedX = ((playerTileX % dungeonWidth) + dungeonWidth) % dungeonWidth;
            const wrappedY = ((playerTileY % dungeonHeight) + dungeonHeight) % dungeonHeight;
            
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(
                offsetX + wrappedX * tileSize + tileSize / 2,
                offsetY + wrappedY * tileSize + tileSize / 2,
                Math.max(2, tileSize),
                0, Math.PI * 2
            );
            ctx.fill();
        }
        
        // Press M hint
        ctx.fillStyle = '#888';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('M: Full Map', x + mapSize / 2, y + mapSize + 12);
        ctx.textAlign = 'left';
    }
    
    renderPotionCounter(ctx) {
        const potions = this.player.potions || { health: 0, mana: 0 };
        const x = 10;
        const y = 120;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x, y, 120, 45);
        
        // Health potion
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('HP', x + 8, y + 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.fillText(`x${potions.health || 0}`, x + 32, y + 18);
        ctx.fillStyle = '#888888';
        ctx.font = '10px Arial';
        ctx.fillText('[R]', x + 65, y + 18);
        
        // Mana potion
        ctx.fillStyle = '#4488ff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('MP', x + 8, y + 38);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.fillText(`x${potions.mana || 0}`, x + 32, y + 38);
        ctx.fillStyle = '#888888';
        ctx.font = '10px Arial';
        ctx.fillText('[F]', x + 65, y + 38);
        
        // Potion icons (simple shapes)
        ctx.save();
        // Health potion icon
        ctx.fillStyle = '#ff6666';
        ctx.beginPath();
        ctx.roundRect(x + 90, y + 5, 12, 16, 2);
        ctx.fill();
        ctx.fillStyle = '#cc3333';
        ctx.fillRect(x + 92, y + 3, 8, 4);
        
        // Mana potion icon
        ctx.fillStyle = '#6688ff';
        ctx.beginPath();
        ctx.roundRect(x + 90, y + 25, 12, 16, 2);
        ctx.fill();
        ctx.fillStyle = '#3355cc';
        ctx.fillRect(x + 92, y + 23, 8, 4);
        ctx.restore();
    }
    
    renderBossBar(ctx) {
        const boss = this.boss;
        if (!boss) return;
        
        const barWidth = this.canvas.width * 0.5;
        const barHeight = 20;
        const x = (this.canvas.width - barWidth) / 2;
        const y = 50; // Top of screen
        
        const healthPercent = Math.max(0, boss.health / boss.maxHealth);
        const pulse = Math.sin(this.bossBarAnimation) * 0.1 + 0.9;
        
        // Boss name title with shadow
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Georgia';
        ctx.fillStyle = '#000';
        ctx.fillText(boss.name || 'Boss', this.canvas.width / 2 + 1, y - 12 + 1);
        
        // Gradient name based on element
        const elementColors = {
            fire: ['#ff6600', '#ff0000'],
            ice: ['#66ccff', '#0066ff'],
            lightning: ['#ffff00', '#ff8800'],
            poison: ['#44ff44', '#008800'],
            holy: ['#ffffaa', '#ffcc00'],
            dark: ['#aa66cc', '#440066'],
            earth: ['#8b7355', '#4a3520'],
            electric: ['#88ffff', '#0088ff'],
            default: ['#ff44ff', '#aa00aa']
        };
        const colors = elementColors[boss.bossElement] || elementColors.default;
        
        const nameGradient = ctx.createLinearGradient(x, y - 30, x + barWidth, y - 10);
        nameGradient.addColorStop(0, colors[0]);
        nameGradient.addColorStop(0.5, '#ffffff');
        nameGradient.addColorStop(1, colors[1]);
        ctx.fillStyle = nameGradient;
        ctx.fillText(boss.name || 'Boss', this.canvas.width / 2, y - 12);
        
        // Outer frame with glow
        ctx.shadowColor = colors[0];
        ctx.shadowBlur = 10 * pulse;
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.roundRect(x - 4, y - 4, barWidth + 8, barHeight + 8, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Inner background
        ctx.fillStyle = '#0a0a14';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 4);
        ctx.fill();
        
        // Health bar gradient
        const healthGradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        if (healthPercent > 0.5) {
            healthGradient.addColorStop(0, colors[0]);
            healthGradient.addColorStop(1, colors[1]);
        } else if (healthPercent > 0.25) {
            healthGradient.addColorStop(0, '#ff8800');
            healthGradient.addColorStop(1, '#aa4400');
        } else {
            healthGradient.addColorStop(0, '#ff4444');
            healthGradient.addColorStop(1, '#880000');
        }
        
        ctx.fillStyle = healthGradient;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, (barWidth - 4) * healthPercent, barHeight - 4, 3);
        ctx.fill();
        
        // Shine overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, (barWidth - 4) * healthPercent, (barHeight - 4) / 2, 3);
        ctx.fill();
        
        // Border with decorative ends
        ctx.strokeStyle = colors[0];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 4);
        ctx.stroke();
        
        // Decorative corner pieces (smaller)
        ctx.fillStyle = colors[0];
        // Left corner
        ctx.beginPath();
        ctx.moveTo(x - 6, y + barHeight / 2);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + barHeight);
        ctx.closePath();
        ctx.fill();
        // Right corner
        ctx.beginPath();
        ctx.moveTo(x + barWidth + 6, y + barHeight / 2);
        ctx.lineTo(x + barWidth, y);
        ctx.lineTo(x + barWidth, y + barHeight);
        ctx.closePath();
        ctx.fill();
        
        // Health percentage text
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.floor(healthPercent * 100)}%`, this.canvas.width / 2, y + barHeight - 5);
        
        // HP numbers (smaller and below)
        ctx.font = '10px Arial';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`${Math.floor(boss.health)} / ${Math.floor(boss.maxHealth)}`, this.canvas.width / 2, y + barHeight + 12);
        
        ctx.restore();
    }
}

// Skill Tree UI Panel
export class SkillTreePanel {
    constructor(canvas, skillTree, character) {
        this.canvas = canvas;
        this.skillTree = skillTree;
        this.character = character;
        this.visible = false;
        this.scrollY = 0;
        this.hoveredSkill = null;
        
        // Keyboard navigation
        this.selectedTier = 0;
        this.selectedIndex = 0;
        this.selectedSkill = null;
    }
    
    show() {
        this.visible = true;
        // Reset selection to first skill
        this.selectedTier = 0;
        this.selectedIndex = 0;
        this.updateSelectedSkill();
    }
    
    hide() {
        this.visible = false;
    }
    
    toggle() {
        this.visible = !this.visible;
        if (this.visible) {
            this.selectedTier = 0;
            this.selectedIndex = 0;
            this.updateSelectedSkill();
        }
    }
    
    // Update the currently selected skill based on tier/index
    updateSelectedSkill() {
        if (!this.skillTree || !this.skillTree.tiers) {
            this.selectedSkill = null;
            return;
        }
        
        // Clamp tier
        if (this.selectedTier >= this.skillTree.tiers.length) {
            this.selectedTier = this.skillTree.tiers.length - 1;
        }
        if (this.selectedTier < 0) this.selectedTier = 0;
        
        const tier = this.skillTree.tiers[this.selectedTier];
        if (!tier || tier.length === 0) {
            this.selectedSkill = null;
            return;
        }
        
        // Clamp index within tier
        if (this.selectedIndex >= tier.length) {
            this.selectedIndex = tier.length - 1;
        }
        if (this.selectedIndex < 0) this.selectedIndex = 0;
        
        this.selectedSkill = tier[this.selectedIndex];
    }
    
    // Handle keyboard input - returns true if key was handled
    handleKeyDown(key) {
        if (!this.visible) return false;
        
        switch (key) {
            case 'ArrowUp':
            case 'KeyW':
                // Move up a tier
                if (this.selectedTier > 0) {
                    this.selectedTier--;
                    this.updateSelectedSkill();
                }
                return true;
                
            case 'ArrowDown':
            case 'KeyS':
                // Move down a tier
                if (this.selectedTier < this.skillTree.tiers.length - 1) {
                    this.selectedTier++;
                    this.updateSelectedSkill();
                }
                return true;
                
            case 'ArrowLeft':
            case 'KeyA':
                // Move left within tier
                if (this.selectedIndex > 0) {
                    this.selectedIndex--;
                    this.updateSelectedSkill();
                }
                return true;
                
            case 'ArrowRight':
            case 'KeyD':
                // Move right within tier
                const tier = this.skillTree.tiers[this.selectedTier];
                if (tier && this.selectedIndex < tier.length - 1) {
                    this.selectedIndex++;
                    this.updateSelectedSkill();
                }
                return true;
                
            case 'Enter':
            case 'Space':
                // Try to unlock selected skill
                if (this.selectedSkill && this.character.skillPoints > 0) {
                    if (this.skillTree.canUnlock(this.selectedSkill.id, this.character.unlockedSkills, 
                        this.character.level, this.character.skillPoints)) {
                        this.character.unlockSkill(this.selectedSkill.id);
                    }
                }
                return true;
                
            case 'Escape':
            case 'KeyK':
                // Close the skill tree
                this.hide();
                return true;
        }
        
        return false;
    }
    
    handleClick(x, y) {
        if (!this.visible) return false;
        
        // Check if click is on a skill
        const skill = this.getSkillAtPosition(x, y);
        if (skill) {
            // Try to unlock skill
            if (this.character.skillPoints > 0 && 
                this.skillTree.canUnlock(skill.id, this.character.unlockedSkills, this.character.level, this.character.skillPoints)) {
                this.character.unlockSkill(skill.id);
                return true;
            }
        }
        
        return false;
    }
    
    handleHover(x, y) {
        if (!this.visible) return;
        this.hoveredSkill = this.getSkillAtPosition(x, y);
    }
    
    getSkillAtPosition(x, y) {
        const panelX = this.canvas.width / 2 - 300;
        const panelY = 100 - this.scrollY;
        const skillSize = 60;
        const tierGap = 100;
        
        for (let tierIndex = 0; tierIndex < this.skillTree.tiers.length; tierIndex++) {
            const tier = this.skillTree.tiers[tierIndex];
            const tierY = panelY + tierIndex * tierGap;
            const tierStartX = panelX + (600 - tier.length * (skillSize + 20)) / 2;
            
            for (let skillIndex = 0; skillIndex < tier.length; skillIndex++) {
                const skill = tier[skillIndex];
                const skillX = tierStartX + skillIndex * (skillSize + 20);
                
                if (x >= skillX && x <= skillX + skillSize &&
                    y >= tierY && y <= tierY + skillSize) {
                    return skill;
                }
            }
        }
        
        return null;
    }
    
    render(ctx) {
        if (!this.visible) return;
        
        // Brick background (matching main menu)
        this.renderBrickBackground(ctx, this.canvas.width, this.canvas.height);
        
        // Dark overlay for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Panel - Book style
        const panelX = this.canvas.width / 2 - 320;
        const panelY = 40;
        const panelW = 640;
        const panelH = this.canvas.height - 80;
        
        // Book shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(panelX + 8, panelY + 8, panelW, panelH, 5);
        ctx.fill();
        
        // Book cover (aged paper look)
        const gradient = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
        gradient.addColorStop(0, '#c4b498');
        gradient.addColorStop(0.5, '#d8ccb8');
        gradient.addColorStop(1, '#c4b498');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 5);
        ctx.fill();
        
        // Book border
        ctx.strokeStyle = '#6b5344';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 5);
        ctx.stroke();
        
        // Title
        ctx.fillStyle = '#3a2a1a';
        ctx.font = 'bold 26px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.character.className} Skill Tree`, this.canvas.width / 2, panelY + 40);
        
        // Decorative line
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + 100, panelY + 55);
        ctx.lineTo(panelX + panelW - 100, panelY + 55);
        ctx.stroke();
        
        // Skill points
        ctx.font = '16px Georgia';
        ctx.fillStyle = '#2a5a2a';
        ctx.fillText(`Available Skill Points: ${this.character.skillPoints}`, this.canvas.width / 2, panelY + 75);
        
        // Draw skills by tier
        const skillSize = 60;
        const tierGap = 100;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(panelX, panelY + 70, panelW, panelH - 80);
        ctx.clip();
        
        for (let tierIndex = 0; tierIndex < this.skillTree.tiers.length; tierIndex++) {
            const tier = this.skillTree.tiers[tierIndex];
            const tierY = panelY + 100 + tierIndex * tierGap - this.scrollY;
            
            // Tier label
            ctx.fillStyle = '#888';
            ctx.font = '12px Georgia';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#5a4a3a';
            ctx.fillText(`Tier ${tierIndex + 1}`, panelX + 15, tierY + 10);
            
            // Skills in tier
            const tierStartX = panelX + (panelW - tier.length * (skillSize + 20)) / 2;
            
            for (let skillIndex = 0; skillIndex < tier.length; skillIndex++) {
                const skill = tier[skillIndex];
                const skillX = tierStartX + skillIndex * (skillSize + 20);
                
                this.renderSkill(ctx, skill, skillX, tierY, skillSize);
            }
            
            // Draw connections to required skills
            for (const skill of tier) {
                if (skill.requires) {
                    // Find required skills and draw lines
                    for (const reqId of skill.requires) {
                        const reqSkill = this.skillTree.getSkill(reqId);
                        if (reqSkill) {
                            // Find positions
                            const skillPos = this.getSkillPosition(skill, panelX, panelY, panelW, skillSize, tierGap);
                            const reqPos = this.getSkillPosition(reqSkill, panelX, panelY, panelW, skillSize, tierGap);
                            
                            if (skillPos && reqPos) {
                                ctx.strokeStyle = this.character.unlockedSkills.has(reqId) ? '#4a4' : '#444';
                                ctx.lineWidth = 2;
                                ctx.beginPath();
                                ctx.moveTo(skillPos.x + skillSize/2, skillPos.y - this.scrollY);
                                ctx.lineTo(reqPos.x + skillSize/2, reqPos.y + skillSize - this.scrollY);
                                ctx.stroke();
                            }
                        }
                    }
                }
            }
        }
        
        ctx.restore();
        
        // Skill tooltip - show for hovered or selected (keyboard navigation) skill
        const tooltipSkill = this.hoveredSkill || this.selectedSkill;
        if (tooltipSkill) {
            this.renderTooltip(ctx, tooltipSkill);
        }
        
        // Controls hint
        ctx.fillStyle = '#5a4a3a';
        ctx.font = '14px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Arrow keys/WASD to navigate, Enter to unlock, K/Escape to close', this.canvas.width / 2, this.canvas.height - 25);
        
        ctx.textAlign = 'left';
    }
    
    // Brick background helper (matching main menu)
    renderBrickBackground(ctx, w, h) {
        const brickWidth = 64;
        const brickHeight = 32;
        const mortarWidth = 4;
        
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, w, h);
        
        for (let row = 0; row < Math.ceil(h / brickHeight) + 1; row++) {
            const offset = (row % 2) * (brickWidth / 2);
            
            for (let col = -1; col < Math.ceil(w / brickWidth) + 1; col++) {
                const x = col * brickWidth + offset;
                const y = row * brickHeight;
                
                const variation = Math.sin(row * 3.7 + col * 2.3) * 15;
                const r = 90 + variation;
                const g = 74 + variation * 0.8;
                const b = 58 + variation * 0.6;
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(x + mortarWidth / 2, y + mortarWidth / 2, brickWidth - mortarWidth, brickHeight - mortarWidth);
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(x + mortarWidth / 2, y + mortarWidth / 2, brickWidth - mortarWidth, 3);
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.fillRect(x + mortarWidth / 2, y + brickHeight - mortarWidth / 2 - 3, brickWidth - mortarWidth, 3);
            }
        }
    }
    
    getSkillPosition(skill, panelX, panelY, panelW, skillSize, tierGap) {
        for (let tierIndex = 0; tierIndex < this.skillTree.tiers.length; tierIndex++) {
            const tier = this.skillTree.tiers[tierIndex];
            const skillIndex = tier.findIndex(s => s.id === skill.id);
            
            if (skillIndex !== -1) {
                const tierY = panelY + 100 + tierIndex * tierGap;
                const tierStartX = panelX + (panelW - tier.length * (skillSize + 20)) / 2;
                const skillX = tierStartX + skillIndex * (skillSize + 20);
                
                return { x: skillX, y: tierY };
            }
        }
        return null;
    }
    
    renderSkill(ctx, skill, x, y, size) {
        const isUnlocked = this.character.unlockedSkills.has(skill.id);
        const canUnlock = this.skillTree.canUnlock(
            skill.id, 
            this.character.unlockedSkills, 
            this.character.level,
            this.character.skillPoints
        );
        const isHovered = this.hoveredSkill === skill;
        const isSelected = this.selectedSkill === skill;
        
        // Selection glow effect for keyboard navigation
        if (isSelected) {
            ctx.save();
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
            ctx.restore();
        }
        
        // Background - book/parchment style
        if (isUnlocked) {
            ctx.fillStyle = '#a8c4a8'; // Green-tinted parchment
        } else if (canUnlock) {
            ctx.fillStyle = '#c4b898'; // Golden parchment
        } else {
            ctx.fillStyle = '#a8a898'; // Gray parchment
        }
        ctx.fillRect(x, y, size, size);
        
        // Inner decoration
        ctx.fillStyle = isUnlocked ? '#8ab48a' : (canUnlock ? '#b4a888' : '#989888');
        ctx.fillRect(x + 4, y + 4, size - 8, size - 20);
        
        // Type indicator
        ctx.fillStyle = skill.type === 'ability' ? '#4466aa' : '#448844';
        ctx.font = '10px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(skill.type === 'ability' ? 'ACT' : 'PAS', x + size/2, y + size/2 - 5);
        
        // Name
        ctx.fillStyle = '#2a1a0a';
        ctx.font = '9px Georgia';
        const shortName = skill.name.length > 10 ? skill.name.substring(0, 9) + '..' : skill.name;
        ctx.fillText(shortName, x + size/2, y + size - 5);
        
        // Border - book style, extra thick for selected
        ctx.strokeStyle = isSelected ? '#ffcc00' : (isHovered ? '#3a2a1a' : (isUnlocked ? '#5a8a5a' : (canUnlock ? '#8a7a4a' : '#6a6a5a')));
        ctx.lineWidth = isSelected ? 4 : (isHovered ? 3 : 2);
        ctx.strokeRect(x, y, size, size);
        
        ctx.textAlign = 'left';
    }
    
    renderTooltip(ctx, skill) {
        // Side panel - fixed position on right side
        const panelW = 280;
        const panelH = 320;
        const x = this.canvas.width - panelW - 30;
        const y = 100;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 4, panelW, panelH, 8);
        ctx.fill();
        
        // Background - parchment style
        const gradient = ctx.createLinearGradient(x, y, x + panelW, y);
        gradient.addColorStop(0, '#d4c4a8');
        gradient.addColorStop(0.5, '#e8dcc8');
        gradient.addColorStop(1, '#d4c4a8');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, panelW, panelH, 8);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = '#6b5344';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, panelW, panelH, 8);
        ctx.stroke();
        
        // Header - "Skill Details"
        ctx.fillStyle = '#5a4a3a';
        ctx.font = 'bold 12px Georgia';
        ctx.fillText('SKILL DETAILS', x + 12, y + 20);
        
        // Separator
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 28);
        ctx.lineTo(x + panelW - 12, y + 28);
        ctx.stroke();
        
        // Title
        ctx.fillStyle = '#2a1a0a';
        ctx.font = 'bold 16px Georgia';
        ctx.fillText(skill.name, x + 12, y + 50);
        
        // Type and tier
        ctx.fillStyle = '#5a4a3a';
        ctx.font = '12px Georgia';
        ctx.fillText(`${skill.type === 'ability' ? 'Active Ability' : 'Passive'} - Tier ${skill.tier}`, x + 12, y + 70);
        
        // Level requirement
        if (skill.levelRequired) {
            ctx.fillStyle = this.character.level >= skill.levelRequired ? '#2a5a2a' : '#8a2a2a';
            ctx.fillText(`Requires Level ${skill.levelRequired}`, x + 12, y + 88);
        }
        
        // Description separator
        ctx.strokeStyle = '#8b7355';
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 100);
        ctx.lineTo(x + panelW - 12, y + 100);
        ctx.stroke();
        
        // Description
        ctx.fillStyle = '#4a3a2a';
        ctx.font = '12px Georgia';
        let descY = y + 118;
        this.wrapText(ctx, skill.description || 'No description available.', x + 12, descY, panelW - 24, 16);
        
        // Show ability or passive stats
        descY = y + 180;
        if (skill.grantsAbility) {
            const ability = skill.grantsAbility;
            ctx.fillStyle = '#4466aa';
            ctx.font = 'bold 11px Georgia';
            ctx.fillText('Ability Stats:', x + 12, descY);
            descY += 16;
            ctx.font = '11px Georgia';
            if (ability.damage) ctx.fillText(`Damage: ${ability.damage}`, x + 16, descY), descY += 14;
            if (ability.cooldown) ctx.fillText(`Cooldown: ${ability.cooldown}s`, x + 16, descY), descY += 14;
            if (ability.manaCost) ctx.fillText(`Mana Cost: ${ability.manaCost}`, x + 16, descY), descY += 14;
            if (ability.range) ctx.fillText(`Range: ${ability.range}`, x + 16, descY), descY += 14;
        } else if (skill.passive) {
            ctx.fillStyle = '#448844';
            ctx.font = 'bold 11px Georgia';
            ctx.fillText('Passive Effects:', x + 12, descY);
            descY += 16;
            ctx.font = '11px Georgia';
            for (const [key, value] of Object.entries(skill.passive)) {
                const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                const displayValue = typeof value === 'number' && value < 1 ? `${(value * 100).toFixed(0)}%` : value;
                ctx.fillText(`${displayKey}: ${displayValue}`, x + 16, descY);
                descY += 14;
            }
        }
        
        // Status - at bottom of panel
        const isUnlocked = this.character.unlockedSkills.has(skill.id);
        const canUnlock = this.skillTree.canUnlock(skill.id, this.character.unlockedSkills, this.character.level, this.character.skillPoints);
        
        ctx.font = 'bold 14px Georgia';
        if (isUnlocked) {
            ctx.fillStyle = '#2a5a2a';
            ctx.fillText('UNLOCKED', x + 12, y + panelH - 20);
        } else if (canUnlock) {
            ctx.fillStyle = '#5a5a2a';
            ctx.fillText('Press Enter to unlock', x + 12, y + panelH - 20);
        } else {
            ctx.fillStyle = '#6a5a4a';
            ctx.fillText('Locked', x + 12, y + panelH - 20);
        }
    }
    
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        
        for (const word of words) {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && line !== '') {
                ctx.fillText(line, x, currentY);
                line = word + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    }
}

// Inventory Panel
export class InventoryPanel {
    constructor(canvas, character) {
        this.canvas = canvas;
        this.character = character;
        this.visible = false;
        this.selectedSlot = 0;
        this.hoveredSlot = -1;
        this.hoveredItem = null;
        this.hoverX = 0;
        this.hoverY = 0;
        
        // Keyboard navigation
        this.selectionMode = 'inventory'; // 'inventory' or 'equipment'
        this.equipmentIndex = 0;
        
        // Grid settings
        this.gridCols = 8;
        this.gridRows = 4;
    }
    
    toggle() {
        this.visible = !this.visible;
        this.hoveredItem = null;
        if (this.visible) {
            this.selectedSlot = 0;
            this.selectionMode = 'inventory';
        }
    }
    
    // Handle keyboard input - returns true if key was handled
    handleKeyDown(key) {
        if (!this.visible) return false;
        
        switch (key) {
            case 'ArrowUp':
            case 'KeyW':
                if (this.selectionMode === 'inventory') {
                    if (this.selectedSlot >= this.gridCols) {
                        this.selectedSlot -= this.gridCols;
                    } else {
                        // Move to equipment slots
                        this.selectionMode = 'equipment';
                        this.equipmentIndex = Math.min(this.selectedSlot, 2); // Top row of equipment
                    }
                } else {
                    // In equipment mode, move between rows
                    if (this.equipmentIndex >= 3) {
                        this.equipmentIndex -= 3;
                    }
                }
                return true;
                
            case 'ArrowDown':
            case 'KeyS':
                if (this.selectionMode === 'inventory') {
                    if (this.selectedSlot < this.gridCols * (this.gridRows - 1)) {
                        this.selectedSlot += this.gridCols;
                    }
                } else {
                    // In equipment mode
                    if (this.equipmentIndex < 3) {
                        this.equipmentIndex += 3;
                    } else {
                        // Move to inventory
                        this.selectionMode = 'inventory';
                        this.selectedSlot = Math.min(this.equipmentIndex - 3, this.gridCols - 1);
                    }
                }
                return true;
                
            case 'ArrowLeft':
            case 'KeyA':
                if (this.selectionMode === 'inventory') {
                    if (this.selectedSlot % this.gridCols > 0) {
                        this.selectedSlot--;
                    }
                } else {
                    if (this.equipmentIndex % 3 > 0) {
                        this.equipmentIndex--;
                    }
                }
                return true;
                
            case 'ArrowRight':
            case 'KeyD':
                if (this.selectionMode === 'inventory') {
                    if (this.selectedSlot % this.gridCols < this.gridCols - 1) {
                        this.selectedSlot++;
                    }
                } else {
                    if (this.equipmentIndex % 3 < 2) {
                        this.equipmentIndex++;
                    }
                }
                return true;
                
            case 'Enter':
            case 'Space':
                this.activateSelectedSlot();
                return true;
                
            case 'Escape':
            case 'KeyI':
                this.toggle();
                return true;
                
            case 'Tab':
                // Switch between inventory and equipment
                this.selectionMode = this.selectionMode === 'inventory' ? 'equipment' : 'inventory';
                return true;
        }
        
        return false;
    }
    
    activateSelectedSlot() {
        const equipSlotKeys = ['weapon', 'armor', 'helmet', 'boots', 'accessory1', 'accessory2'];
        
        if (this.selectionMode === 'equipment') {
            // Unequip item from equipment slot
            const slotKey = equipSlotKeys[this.equipmentIndex];
            const item = this.character.equipment?.[slotKey];
            if (item) {
                const emptySlot = this.character.inventory?.findIndex(i => !i);
                if (emptySlot !== -1 && emptySlot !== undefined) {
                    this.character.inventory[emptySlot] = item;
                    this.character.equipment[slotKey] = null;
                    if (this.character.recalculateStats) {
                        this.character.recalculateStats();
                    }
                }
            }
        } else {
            // Equip item from inventory
            const item = this.character.inventory?.[this.selectedSlot];
            if (item) {
                const slot = item.slot || (item.type === 'weapon' ? 'weapon' : 
                                           item.type === 'armor' ? 'armor' :
                                           item.type === 'helmet' ? 'helmet' :
                                           item.type === 'boots' ? 'boots' :
                                           item.type === 'accessory' ? 'accessory1' : null);
                if (slot && this.character.equipment) {
                    const oldItem = this.character.equipment[slot];
                    this.character.inventory[this.selectedSlot] = null;
                    this.character.equipment[slot] = item;
                    if (oldItem) {
                        this.character.inventory[this.selectedSlot] = oldItem;
                    }
                    if (this.character.recalculateStats) {
                        this.character.recalculateStats();
                    }
                }
            }
        }
    }
    
    getSelectedItem() {
        const equipSlotKeys = ['weapon', 'armor', 'helmet', 'boots', 'accessory1', 'accessory2'];
        
        if (this.selectionMode === 'equipment') {
            return this.character.equipment?.[equipSlotKeys[this.equipmentIndex]];
        } else {
            return this.character.inventory?.[this.selectedSlot];
        }
    }
    
    handleMouseMove(x, y) {
        if (!this.visible) return;
        
        const panelW = 500;
        const panelH = 580;
        const panelX = this.canvas.width / 2 - panelW / 2;
        const panelY = this.canvas.height / 2 - panelH / 2;
        
        // Check inventory grid
        const gridX = panelX + 25;
        const gridY = panelY + 290;
        const slotSize = 50;
        const spacing = 6;
        const gridCols = 8;
        const gridRows = 4;
        
        this.hoveredSlot = -1;
        this.hoveredItem = null;
        
        for (let i = 0; i < gridCols * gridRows; i++) {
            const slotX = gridX + (i % gridCols) * (slotSize + spacing);
            const slotY = gridY + Math.floor(i / gridCols) * (slotSize + spacing);
            
            if (x >= slotX && x <= slotX + slotSize && y >= slotY && y <= slotY + slotSize) {
                this.hoveredSlot = i;
                if (this.character.inventory?.[i]) {
                    this.hoveredItem = this.character.inventory[i];
                    this.hoverX = x + 15;
                    this.hoverY = y + 15;
                }
                return;
            }
        }
        
        // Check equipment slots
        const equipX = panelX + 180;
        const equipY = panelY + 80;
        const equipSize = 55;
        const equipSpacing = 8;
        const equipSlots = [
            { key: 'weapon', x: 0, y: 0 },
            { key: 'armor', x: 1, y: 0 },
            { key: 'helmet', x: 2, y: 0 },
            { key: 'boots', x: 0, y: 1 },
            { key: 'accessory1', x: 1, y: 1 },
            { key: 'accessory2', x: 2, y: 1 }
        ];
        
        for (const slot of equipSlots) {
            const slotX = equipX + slot.x * (equipSize + equipSpacing);
            const slotY = equipY + slot.y * (equipSize + equipSpacing + 20);
            
            if (x >= slotX && x <= slotX + equipSize && y >= slotY && y <= slotY + equipSize) {
                const item = this.character.equipment?.[slot.key];
                if (item) {
                    this.hoveredItem = item;
                    this.hoverX = x + 15;
                    this.hoverY = y + 15;
                }
                return;
            }
        }
    }
    
    // Brick background helper
    renderBrickBackground(ctx, w, h) {
        const brickWidth = 64;
        const brickHeight = 32;
        const mortarWidth = 4;
        
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, w, h);
        
        for (let row = 0; row < Math.ceil(h / brickHeight) + 1; row++) {
            const offset = (row % 2) * (brickWidth / 2);
            
            for (let col = -1; col < Math.ceil(w / brickWidth) + 1; col++) {
                const x = col * brickWidth + offset;
                const y = row * brickHeight;
                
                const variation = Math.sin(row * 3.7 + col * 2.3) * 15;
                const r = 90 + variation;
                const g = 74 + variation * 0.8;
                const b = 58 + variation * 0.6;
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(x + mortarWidth / 2, y + mortarWidth / 2, brickWidth - mortarWidth, brickHeight - mortarWidth);
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(x + mortarWidth / 2, y + mortarWidth / 2, brickWidth - mortarWidth, 3);
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.fillRect(x + mortarWidth / 2, y + brickHeight - mortarWidth / 2 - 3, brickWidth - mortarWidth, 3);
            }
        }
    }
    
    render(ctx) {
        if (!this.visible) return;
        
        // Dark overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Panel dimensions
        const panelW = 500;
        const panelH = 580;
        const panelX = this.canvas.width / 2 - panelW / 2;
        const panelY = this.canvas.height / 2 - panelH / 2;
        
        // Main panel - dark stone style
        const stoneGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
        stoneGrad.addColorStop(0, '#3a3a4a');
        stoneGrad.addColorStop(0.5, '#2a2a38');
        stoneGrad.addColorStop(1, '#1a1a28');
        ctx.fillStyle = stoneGrad;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 10);
        ctx.fill();
        
        // Gold border
        ctx.strokeStyle = '#c4a35a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 10);
        ctx.stroke();
        
        // Inner border
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16, 6);
        ctx.stroke();
        
        // Title with decorative underline
        ctx.fillStyle = '#c4a35a';
        ctx.font = 'bold 26px Georgia';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText('[ Inventory ]', this.canvas.width / 2, panelY + 40);
        ctx.shadowBlur = 0;
        
        // Decorative line
        ctx.strokeStyle = '#c4a35a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(panelX + 100, panelY + 55);
        ctx.lineTo(panelX + panelW - 100, panelY + 55);
        ctx.stroke();
        
        // Character stats section (left side)
        this.renderCharacterStats(ctx, panelX + 20, panelY + 70, 140);
        
        // Equipment section (right of stats)
        this.renderEquipmentSlots(ctx, panelX + 180, panelY + 70);
        
        // Inventory grid
        this.renderInventoryGrid(ctx, panelX + 25, panelY + 280);
        
        // Gold display with icon
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 18px Georgia';
        ctx.textAlign = 'right';
        ctx.fillText(`Gold: ${this.character.gold || 0}`, panelX + panelW - 25, panelY + panelH - 45);
        
        // Potions display
        const potions = this.character.potions || { health: 0, mana: 0 };
        ctx.fillStyle = '#ff6666';
        ctx.font = '14px Georgia';
        ctx.fillText(`HP Potions: ${potions.health || 0}  (R)`, panelX + panelW - 25, panelY + panelH - 70);
        ctx.fillStyle = '#6666ff';
        ctx.fillText(`MP Potions: ${potions.mana || 0}  (F)`, panelX + panelW - 25, panelY + panelH - 90);
        
        // Close hint
        ctx.fillStyle = '#888';
        ctx.font = '12px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Arrow keys to navigate  |  Enter to equip  |  Tab to switch  |  I to close', this.canvas.width / 2, panelY + panelH - 15);
        
        // Render side panel with selected item description
        const selectedItem = this.getSelectedItem() || this.hoveredItem;
        if (selectedItem) {
            this.renderItemSidePanel(ctx, panelX + panelW + 15, panelY + 50, selectedItem);
        }
        
        ctx.textAlign = 'left';
    }
    
    renderItemSidePanel(ctx, x, y, item) {
        const panelW = 220;
        const panelH = 300;
        
        // Background
        const gradient = ctx.createLinearGradient(x, y, x, y + panelH);
        gradient.addColorStop(0, '#3a3a4a');
        gradient.addColorStop(1, '#2a2a38');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, panelW, panelH, 8);
        ctx.fill();
        
        // Border with rarity color
        const rarityColors = {
            common: '#888888',
            uncommon: '#44ff44',
            rare: '#4488ff',
            epic: '#aa44ff',
            legendary: '#ffaa00'
        };
        ctx.strokeStyle = rarityColors[item.rarity] || '#c4a35a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, panelW, panelH, 8);
        ctx.stroke();
        
        // Title
        ctx.fillStyle = rarityColors[item.rarity] || '#fff';
        ctx.font = 'bold 14px Georgia';
        ctx.textAlign = 'left';
        ctx.fillText(item.name || 'Unknown Item', x + 12, y + 25);
        
        // Item type/slot
        ctx.fillStyle = '#888';
        ctx.font = '11px Georgia';
        const itemType = item.slot || item.type || 'Item';
        const rarityText = item.rarity ? item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1) : '';
        ctx.fillText(`${rarityText} ${itemType}`, x + 12, y + 42);
        
        // Level requirement
        if (item.level) {
            ctx.fillText(`Level ${item.level}`, x + 12, y + 56);
        }
        
        // Separator line
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 68);
        ctx.lineTo(x + panelW - 12, y + 68);
        ctx.stroke();
        
        // Stats
        let statY = y + 88;
        ctx.font = '12px Georgia';
        
        if (item.damage) {
            ctx.fillStyle = '#ff6666';
            ctx.fillText(`Damage: +${item.damage}`, x + 12, statY);
            statY += 18;
        }
        if (item.defense) {
            ctx.fillStyle = '#66aaff';
            ctx.fillText(`Defense: +${item.defense}`, x + 12, statY);
            statY += 18;
        }
        if (item.range) {
            ctx.fillStyle = '#aaa';
            ctx.fillText(`Range: ${item.range}`, x + 12, statY);
            statY += 18;
        }
        if (item.attackSpeed) {
            ctx.fillStyle = '#aaa';
            ctx.fillText(`Attack Speed: ${item.attackSpeed.toFixed(1)}`, x + 12, statY);
            statY += 18;
        }
        if (item.critBonus) {
            ctx.fillStyle = '#ffcc00';
            ctx.fillText(`Crit Chance: +${item.critBonus}%`, x + 12, statY);
            statY += 18;
        }
        if (item.lifeSteal) {
            ctx.fillStyle = '#ff66aa';
            ctx.fillText(`Life Steal: ${(item.lifeSteal * 100).toFixed(0)}%`, x + 12, statY);
            statY += 18;
        }
        if (item.manaRegen) {
            ctx.fillStyle = '#6666ff';
            ctx.fillText(`Mana Regen: +${item.manaRegen}`, x + 12, statY);
            statY += 18;
        }
        if (item.spellPower) {
            ctx.fillStyle = '#aa66ff';
            ctx.fillText(`Spell Power: +${(item.spellPower * 100).toFixed(0)}%`, x + 12, statY);
            statY += 18;
        }
        
        // Bonus stats
        if (item.stats && Object.keys(item.stats).length > 0) {
            statY += 5;
            ctx.fillStyle = '#66ff66';
            for (const [stat, value] of Object.entries(item.stats)) {
                ctx.fillText(`+${Math.floor(value)} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`, x + 12, statY);
                statY += 16;
            }
        }
        
        // Description
        if (item.description) {
            statY += 10;
            ctx.fillStyle = '#aaa';
            ctx.font = '11px Georgia';
            this.wrapText(ctx, item.description, x + 12, statY, panelW - 24, 14);
        }
        
        // Action hint at bottom
        ctx.fillStyle = '#c4a35a';
        ctx.font = 'bold 11px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Press Enter to equip', x + panelW / 2, y + panelH - 15);
        ctx.textAlign = 'left';
    }
    
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        if (!text) return;
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        
        for (const word of words) {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && line !== '') {
                ctx.fillText(line, x, currentY);
                line = word + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    }
    
    renderCharacterStats(ctx, x, y, width) {
        // Stats box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.roundRect(x, y, width, 180, 5);
        ctx.fill();
        
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, width, 180, 5);
        ctx.stroke();
        
        ctx.font = 'bold 14px Georgia';
        ctx.fillStyle = '#c4a35a';
        ctx.fillText('Stats', x + 10, y + 20);
        
        const stats = [
            { label: 'STR', value: Math.floor(this.character.stats?.strength || 0), color: '#ff6666' },
            { label: 'AGI', value: Math.floor(this.character.stats?.agility || 0), color: '#66ff66' },
            { label: 'INT', value: Math.floor(this.character.stats?.intelligence || 0), color: '#6666ff' },
            { label: 'VIT', value: Math.floor(this.character.stats?.vitality || 0), color: '#ffff66' },
            { label: 'LCK', value: Math.floor(this.character.stats?.luck || 0), color: '#ff66ff' }
        ];
        
        ctx.font = '12px Georgia';
        stats.forEach((stat, i) => {
            const sy = y + 40 + i * 22;
            ctx.fillStyle = stat.color;
            ctx.fillText(stat.label, x + 10, sy);
            ctx.fillStyle = '#fff';
            ctx.fillText(stat.value.toString(), x + 50, sy);
            
            // Stat bar
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x + 75, sy - 10, 55, 12);
            ctx.fillStyle = stat.color;
            const barW = Math.min(55, (stat.value / 30) * 55);
            ctx.fillRect(x + 75, sy - 10, barW, 12);
        });
        
        // Defense & Attack
        ctx.font = '11px Georgia';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`ATK: ${Math.floor(this.character.attackDamage || 10)}`, x + 10, y + 165);
        ctx.fillText(`DEF: ${Math.floor(this.character.defense || 0)}`, x + 75, y + 165);
    }
    
    renderEquipmentSlots(ctx, x, y) {
        const slotSize = 55;
        const spacing = 8;
        const equipSlots = [
            { key: 'weapon', icon: 'W', label: 'Weapon', x: 0, y: 0, idx: 0 },
            { key: 'armor', icon: 'A', label: 'Armor', x: 1, y: 0, idx: 1 },
            { key: 'helmet', icon: 'H', label: 'Head', x: 2, y: 0, idx: 2 },
            { key: 'boots', icon: 'B', label: 'Boots', x: 0, y: 1, idx: 3 },
            { key: 'accessory1', icon: 'R', label: 'Ring 1', x: 1, y: 1, idx: 4 },
            { key: 'accessory2', icon: 'R', label: 'Ring 2', x: 2, y: 1, idx: 5 }
        ];
        
        ctx.font = 'bold 14px Georgia';
        ctx.fillStyle = '#c4a35a';
        ctx.fillText('Equipment' + (this.selectionMode === 'equipment' ? ' [SELECTED]' : ''), x, y - 5);
        
        for (const slot of equipSlots) {
            const slotX = x + slot.x * (slotSize + spacing);
            const slotY = y + 10 + slot.y * (slotSize + spacing + 20);
            const item = this.character.equipment?.[slot.key];
            const isSelected = this.selectionMode === 'equipment' && this.equipmentIndex === slot.idx;
            
            // Selection glow
            if (isSelected) {
                ctx.save();
                ctx.shadowColor = '#ffcc00';
                ctx.shadowBlur = 12;
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(slotX - 3, slotY - 3, slotSize + 6, slotSize + 6);
                ctx.restore();
            }
            
            // Slot background
            const slotGrad = ctx.createLinearGradient(slotX, slotY, slotX, slotY + slotSize);
            if (item) {
                const rarityColors = {
                    common: ['#4a4a5a', '#3a3a4a'],
                    uncommon: ['#3a5a3a', '#2a4a2a'],
                    rare: ['#3a3a6a', '#2a2a5a'],
                    epic: ['#5a3a6a', '#4a2a5a'],
                    legendary: ['#6a5a2a', '#5a4a1a']
                };
                const colors = rarityColors[item.rarity] || rarityColors.common;
                slotGrad.addColorStop(0, colors[0]);
                slotGrad.addColorStop(1, colors[1]);
            } else {
                slotGrad.addColorStop(0, '#2a2a3a');
                slotGrad.addColorStop(1, '#1a1a2a');
            }
            ctx.fillStyle = slotGrad;
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotSize, slotSize, 5);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = item ? '#888' : '#444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotSize, slotSize, 5);
            ctx.stroke();
            
            // Item or empty icon
            ctx.font = '22px Georgia';
            ctx.textAlign = 'center';
            if (item) {
                ctx.fillStyle = item.color || '#fff';
                ctx.fillText(this.getItemIcon(item), slotX + slotSize/2, slotY + slotSize/2 + 8);
            } else {
                ctx.fillStyle = '#444';
                ctx.fillText(slot.icon, slotX + slotSize/2, slotY + slotSize/2 + 8);
            }
            
            // Slot label
            ctx.font = '9px Georgia';
            ctx.fillStyle = '#666';
            ctx.fillText(slot.label, slotX + slotSize/2, slotY + slotSize + 12);
        }
        ctx.textAlign = 'left';
    }
    
    renderInventoryGrid(ctx, x, y) {
        const slotSize = 50;
        const spacing = 6;
        const gridCols = this.gridCols;
        const gridRows = this.gridRows;
        
        ctx.font = 'bold 14px Georgia';
        ctx.fillStyle = '#c4a35a';
        ctx.fillText('Backpack' + (this.selectionMode === 'inventory' ? ' [SELECTED]' : ''), x, y - 5);
        
        for (let i = 0; i < gridCols * gridRows; i++) {
            const item = this.character.inventory?.[i];
            const slotX = x + (i % gridCols) * (slotSize + spacing);
            const slotY = y + 10 + Math.floor(i / gridCols) * (slotSize + spacing);
            
            const isHovered = i === this.hoveredSlot;
            const isSelected = this.selectionMode === 'inventory' && i === this.selectedSlot;
            
            // Selection glow for keyboard navigation
            if (isSelected) {
                ctx.save();
                ctx.shadowColor = '#ffcc00';
                ctx.shadowBlur = 10;
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(slotX - 2, slotY - 2, slotSize + 4, slotSize + 4);
                ctx.restore();
            }
            
            // Slot background
            ctx.fillStyle = isHovered ? '#3a3a4a' : (isSelected ? '#4a4a5a' : '#2a2a3a');
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotSize, slotSize, 4);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = isSelected ? '#ffcc00' : (isHovered ? '#c4a35a' : '#444');
            ctx.lineWidth = isSelected ? 3 : (isHovered ? 2 : 1);
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotSize, slotSize, 4);
            ctx.stroke();
            
            // Item
            if (item) {
                // Rarity glow
                if (item.rarity && item.rarity !== 'common') {
                    const glowColors = {
                        uncommon: '#44ff44',
                        rare: '#4444ff',
                        epic: '#aa44ff',
                        legendary: '#ffaa00'
                    };
                    ctx.shadowColor = glowColors[item.rarity] || '#fff';
                    ctx.shadowBlur = 5;
                }
                
                ctx.font = '20px Georgia';
                ctx.textAlign = 'center';
                ctx.fillStyle = item.color || '#fff';
                ctx.fillText(this.getItemIcon(item), slotX + slotSize/2, slotY + slotSize/2 + 6);
                ctx.shadowBlur = 0;
                
                // Stack count
                if (item.count && item.count > 1) {
                    ctx.font = 'bold 10px Arial';
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'right';
                    ctx.fillText(item.count.toString(), slotX + slotSize - 3, slotY + slotSize - 3);
                }
            }
        }
        ctx.textAlign = 'left';
    }
    
    getItemIcon(item) {
        const icons = {
            weapon: 'W',
            sword: 'S',
            axe: 'X',
            bow: 'B',
            staff: 'T',
            armor: 'A',
            helmet: 'H',
            boots: 'F',
            accessory: 'R',
            potion: 'P',
            key: 'K',
            scroll: 'C',
            food: 'F',
            gold: 'G'
        };
        return icons[item.type] || icons[item.slot] || '?';
    }
    
    renderItemTooltip(ctx, item, x, y) {
        const tooltipW = 180;
        const tooltipH = 100;
        
        // Clamp to screen
        x = Math.min(x, this.canvas.width - tooltipW - 10);
        y = Math.min(y, this.canvas.height - tooltipH - 10);
        
        // Background
        ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
        ctx.beginPath();
        ctx.roundRect(x, y, tooltipW, tooltipH, 5);
        ctx.fill();
        
        ctx.strokeStyle = '#c4a35a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, tooltipW, tooltipH, 5);
        ctx.stroke();
        
        // Item name
        const rarityColors = {
            common: '#fff',
            uncommon: '#44ff44',
            rare: '#4444ff',
            epic: '#aa44ff',
            legendary: '#ffaa00'
        };
        ctx.font = 'bold 12px Georgia';
        ctx.fillStyle = rarityColors[item.rarity] || '#fff';
        ctx.fillText(item.name || 'Unknown', x + 10, y + 20);
        
        // Stats
        ctx.font = '10px Georgia';
        ctx.fillStyle = '#aaa';
        let lineY = y + 38;
        if (item.damage) {
            ctx.fillText(`Damage: +${item.damage}`, x + 10, lineY);
            lineY += 14;
        }
        if (item.defense) {
            ctx.fillText(`Defense: +${item.defense}`, x + 10, lineY);
            lineY += 14;
        }
        if (item.description) {
            ctx.fillStyle = '#888';
            ctx.fillText(item.description.substring(0, 25), x + 10, lineY);
        }
    }
    
    handleClick(x, y) {
        if (!this.visible) return false;
        
        const panelW = 420;
        const panelH = 520;
        const panelX = this.canvas.width / 2 - panelW / 2;
        const panelY = this.canvas.height / 2 - panelH / 2;
        const slotSize = 50;
        const equipSlots = ['weapon', 'armor', 'helmet', 'boots', 'accessory1', 'accessory2'];
        const gridCols = 5;
        const gridRows = 4;
        
        // Check equipment slots
        for (let i = 0; i < equipSlots.length; i++) {
            const slotX = panelX + 25 + (i % 3) * (slotSize + 15);
            const slotY = panelY + 90 + Math.floor(i / 3) * (slotSize + 15);
            
            if (x >= slotX && x <= slotX + slotSize && y >= slotY && y <= slotY + slotSize) {
                // Click on equipment slot - could unequip
                const slot = equipSlots[i];
                const item = this.character.equipment[slot];
                if (item) {
                    // Move to inventory if space
                    const emptySlot = this.character.inventory.findIndex(i => !i);
                    if (emptySlot !== -1) {
                        this.character.inventory[emptySlot] = item;
                        this.character.equipment[slot] = null;
                    }
                }
                return true;
            }
        }
        
        // Check inventory slots
        for (let i = 0; i < gridCols * gridRows; i++) {
            const slotX = panelX + 25 + (i % gridCols) * (slotSize + 10);
            const slotY = panelY + 230 + Math.floor(i / gridCols) * (slotSize + 10);
            
            if (x >= slotX && x <= slotX + slotSize && y >= slotY && y <= slotY + slotSize) {
                const item = this.character.inventory[i];
                if (item) {
                    // Determine slot for item
                    const slot = item.slot || (item.type === 'weapon' ? 'weapon' : 
                                               item.type === 'armor' ? 'armor' :
                                               item.type === 'helmet' ? 'helmet' :
                                               item.type === 'boots' ? 'boots' :
                                               item.type === 'accessory' ? 'accessory1' : null);
                    if (slot && this.character.equipment) {
                        // Get old item first before any changes
                        const oldItem = this.character.equipment[slot];
                        
                        // Remove item from inventory FIRST to prevent dupe
                        this.character.inventory[i] = null;
                        
                        // Equip new item
                        this.character.equipment[slot] = item;
                        
                        // Put old item in inventory slot where new item was
                        if (oldItem) {
                            this.character.inventory[i] = oldItem;
                        }
                        
                        // Update stats (but don't add to inventory again)
                        if (this.character.recalculateStats) {
                            this.character.recalculateStats();
                        }
                    }
                }
                this.selectedSlot = i;
                return true;
            }
        }
        
        return false;
    }
    
    handleHover(x, y) {
        if (!this.visible) return;
        
        const panelW = 420;
        const panelX = this.canvas.width / 2 - panelW / 2;
        const panelY = this.canvas.height / 2 - 520 / 2;
        const slotSize = 50;
        const gridCols = 5;
        const gridRows = 4;
        
        this.hoveredSlot = -1;
        
        for (let i = 0; i < gridCols * gridRows; i++) {
            const slotX = panelX + 25 + (i % gridCols) * (slotSize + 10);
            const slotY = panelY + 230 + Math.floor(i / gridCols) * (slotSize + 10);
            
            if (x >= slotX && x <= slotX + slotSize && y >= slotY && y <= slotY + slotSize) {
                this.hoveredSlot = i;
                return;
            }
        }
    }
}

// Pause Menu with Settings
export class PauseMenu {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.visible = false;
        this.activeTab = 'controls'; // 'controls', 'visuals', 'audio'
        this.hoveredButton = null;
        
        // Settings with defaults
        this.settings = {
            // Audio
            masterVolume: 1.0,
            musicVolume: 0.5,
            sfxVolume: 0.7,
            // Visuals
            screenShake: true,
            hitFreeze: true,
            screenFlash: true,
            particles: true,
            // Controls are just displayed, not changeable yet
        };
        
        // Load settings from localStorage if available
        this.loadSettings();
        
        // Button positions (calculated in render)
        this.buttons = [];
        this.sliders = [];
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('delugeSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
    }
    
    saveSettings() {
        try {
            localStorage.setItem('delugeSettings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }
    
    applySettings() {
        // Apply audio settings to SoundManager using proper setters
        if (this.game.soundManager) {
            this.game.soundManager.setMasterVolume(this.settings.masterVolume);
            this.game.soundManager.setMusicVolume(this.settings.musicVolume);
            this.game.soundManager.setSfxVolume(this.settings.sfxVolume);
        }
        
        // Apply visual settings to game
        this.game.visualSettings = {
            screenShake: this.settings.screenShake,
            hitFreeze: this.settings.hitFreeze,
            screenFlash: this.settings.screenFlash,
            particles: this.settings.particles
        };
        
        this.saveSettings();
    }
    
    show() {
        this.visible = true;
        this.applySettings();
    }
    
    hide() {
        this.visible = false;
        this.saveSettings();
    }
    
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    handleClick(x, y) {
        if (!this.visible) return false;
        
        // Check tab buttons
        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                if (btn.action === 'tab') {
                    this.activeTab = btn.value;
                    return true;
                } else if (btn.action === 'toggle') {
                    this.settings[btn.key] = !this.settings[btn.key];
                    this.applySettings();
                    return true;
                } else if (btn.action === 'resume') {
                    this.hide();
                    return true;
                } else if (btn.action === 'quit') {
                    // Return to main menu (class select)
                    this.hide();
                    this.game.returnToMainMenu();
                    return true;
                }
            }
        }
        
        // Check sliders
        for (const slider of this.sliders) {
            if (x >= slider.x && x <= slider.x + slider.w && 
                y >= slider.y - 10 && y <= slider.y + 10) {
                const value = (x - slider.x) / slider.w;
                this.settings[slider.key] = Math.max(0, Math.min(1, value));
                this.applySettings();
                return true;
            }
        }
        
        return false;
    }
    
    handleHover(x, y) {
        if (!this.visible) return;
        
        this.hoveredButton = null;
        
        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                this.hoveredButton = btn;
                return;
            }
        }
    }
    
    handleDrag(x, y) {
        if (!this.visible) return false;
        
        // Handle slider dragging
        for (const slider of this.sliders) {
            if (x >= slider.x - 10 && x <= slider.x + slider.w + 10 && 
                y >= slider.y - 15 && y <= slider.y + 15) {
                const value = (x - slider.x) / slider.w;
                this.settings[slider.key] = Math.max(0, Math.min(1, value));
                this.applySettings();
                return true;
            }
        }
        
        return false;
    }
    
    render(ctx) {
        if (!this.visible) return;
        
        // Reset button/slider positions
        this.buttons = [];
        this.sliders = [];
        
        // Full screen dim overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Panel dimensions
        const panelW = 500;
        const panelH = 450;
        const panelX = this.canvas.width / 2 - panelW / 2;
        const panelY = this.canvas.height / 2 - panelH / 2;
        
        // Panel background - dark stone style
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        
        // Border
        ctx.strokeStyle = '#4a4a6a';
        ctx.lineWidth = 3;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', this.canvas.width / 2, panelY + 40);
        
        // Tab buttons
        const tabs = ['controls', 'visuals', 'audio'];
        const tabW = 140;
        const tabH = 35;
        const tabY = panelY + 60;
        
        tabs.forEach((tab, i) => {
            const tabX = panelX + 30 + i * (tabW + 10);
            const isActive = this.activeTab === tab;
            
            ctx.fillStyle = isActive ? '#3a3a5a' : '#2a2a4a';
            ctx.fillRect(tabX, tabY, tabW, tabH);
            
            if (isActive) {
                ctx.strokeStyle = '#6a6aaa';
                ctx.lineWidth = 2;
                ctx.strokeRect(tabX, tabY, tabW, tabH);
            }
            
            ctx.fillStyle = isActive ? '#ffffff' : '#aaaaaa';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(tab.toUpperCase(), tabX + tabW / 2, tabY + 23);
            
            this.buttons.push({ x: tabX, y: tabY, w: tabW, h: tabH, action: 'tab', value: tab });
        });
        
        // Content area
        const contentY = tabY + tabH + 20;
        
        if (this.activeTab === 'controls') {
            this.renderControlsTab(ctx, panelX, contentY, panelW);
        } else if (this.activeTab === 'visuals') {
            this.renderVisualsTab(ctx, panelX, contentY, panelW);
        } else if (this.activeTab === 'audio') {
            this.renderAudioTab(ctx, panelX, contentY, panelW);
        }
        
        // Bottom buttons
        const btnW = 120;
        const btnH = 40;
        const btnY = panelY + panelH - 60;
        
        // Resume button
        const resumeX = panelX + panelW / 2 - btnW - 20;
        const isResumeHovered = this.hoveredButton?.action === 'resume';
        ctx.fillStyle = isResumeHovered ? '#4a7a4a' : '#3a5a3a';
        ctx.fillRect(resumeX, btnY, btnW, btnH);
        ctx.strokeStyle = '#5a8a5a';
        ctx.lineWidth = 2;
        ctx.strokeRect(resumeX, btnY, btnW, btnH);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('RESUME', resumeX + btnW / 2, btnY + 26);
        this.buttons.push({ x: resumeX, y: btnY, w: btnW, h: btnH, action: 'resume' });
        
        // Quit button
        const quitX = panelX + panelW / 2 + 20;
        const isQuitHovered = this.hoveredButton?.action === 'quit';
        ctx.fillStyle = isQuitHovered ? '#7a4a4a' : '#5a3a3a';
        ctx.fillRect(quitX, btnY, btnW, btnH);
        ctx.strokeStyle = '#8a5a5a';
        ctx.lineWidth = 2;
        ctx.strokeRect(quitX, btnY, btnW, btnH);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('QUIT', quitX + btnW / 2, btnY + 26);
        this.buttons.push({ x: quitX, y: btnY, w: btnW, h: btnH, action: 'quit' });
    }
    
    renderControlsTab(ctx, panelX, startY, panelW) {
        ctx.textAlign = 'left';
        ctx.font = '15px Arial';
        
        const controls = [
            { key: 'W A S D', action: 'Move' },
            { key: 'Mouse', action: 'Aim' },
            { key: 'Left Click', action: 'Attack' },
            { key: 'Right Click', action: 'Dash' },
            { key: 'E', action: 'Interact' },
            { key: 'K', action: 'Skill Tree' },
            { key: 'I', action: 'Inventory' },
            { key: 'C', action: 'Crafting' },
            { key: 'M', action: 'Fullscreen Map' },
            { key: 'Shift', action: 'Sprint (hold)' },
            { key: 'Escape', action: 'Pause Menu' },
        ];
        
        controls.forEach((ctrl, i) => {
            const y = startY + 10 + i * 24;
            
            // Key box
            ctx.fillStyle = '#2a2a4a';
            ctx.fillRect(panelX + 30, y, 100, 20);
            ctx.fillStyle = '#aaccff';
            ctx.textAlign = 'center';
            ctx.fillText(ctrl.key, panelX + 80, y + 15);
            
            // Action
            ctx.fillStyle = '#cccccc';
            ctx.textAlign = 'left';
            ctx.fillText(ctrl.action, panelX + 150, y + 15);
        });
    }
    
    renderVisualsTab(ctx, panelX, startY, panelW) {
        const toggles = [
            { key: 'screenShake', label: 'Screen Shake' },
            { key: 'hitFreeze', label: 'Hit Freeze' },
            { key: 'screenFlash', label: 'Screen Flash' },
            { key: 'particles', label: 'Particles' },
        ];
        
        toggles.forEach((toggle, i) => {
            const y = startY + 20 + i * 45;
            const enabled = this.settings[toggle.key];
            
            // Label
            ctx.fillStyle = '#cccccc';
            ctx.font = '16px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(toggle.label, panelX + 40, y + 5);
            
            // Toggle button
            const btnX = panelX + panelW - 120;
            const btnW = 80;
            const btnH = 30;
            
            ctx.fillStyle = enabled ? '#3a6a3a' : '#5a3a3a';
            ctx.fillRect(btnX, y - 12, btnW, btnH);
            ctx.strokeStyle = enabled ? '#5a9a5a' : '#8a5a5a';
            ctx.lineWidth = 2;
            ctx.strokeRect(btnX, y - 12, btnW, btnH);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(enabled ? 'ON' : 'OFF', btnX + btnW / 2, y + 7);
            
            this.buttons.push({ x: btnX, y: y - 12, w: btnW, h: btnH, action: 'toggle', key: toggle.key });
        });
    }
    
    renderAudioTab(ctx, panelX, startY, panelW) {
        const sliderConfigs = [
            { key: 'masterVolume', label: 'Master Volume' },
            { key: 'musicVolume', label: 'Music Volume' },
            { key: 'sfxVolume', label: 'SFX Volume' },
        ];
        
        sliderConfigs.forEach((slider, i) => {
            const y = startY + 30 + i * 60;
            const value = this.settings[slider.key];
            
            // Label
            ctx.fillStyle = '#cccccc';
            ctx.font = '16px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(slider.label, panelX + 40, y);
            
            // Slider track
            const sliderX = panelX + 40;
            const sliderW = panelW - 120;
            const sliderY = y + 25;
            
            ctx.fillStyle = '#2a2a4a';
            ctx.fillRect(sliderX, sliderY - 4, sliderW, 8);
            
            // Filled portion
            ctx.fillStyle = '#4a7aaa';
            ctx.fillRect(sliderX, sliderY - 4, sliderW * value, 8);
            
            // Handle
            const handleX = sliderX + sliderW * value;
            ctx.fillStyle = '#aaccff';
            ctx.beginPath();
            ctx.arc(handleX, sliderY, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Percentage
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(value * 100) + '%', panelX + panelW - 30, y);
            
            this.sliders.push({ x: sliderX, y: sliderY, w: sliderW, key: slider.key });
        });
    }
}

// Class Selection Screen - Book-style with animated player sprites
export class ClassSelectionUI {
    constructor(canvas, classes, onSelect, soundManager = null) {
        this.canvas = canvas;
        this.classes = classes;
        this.onSelect = onSelect;
        this.soundManager = soundManager;
        this.selectedClass = null;
        this.hoveredClass = null;
        this.currentIndex = 0;
        this.classNames = Object.keys(classes);
        this.transitioning = false;
        this.transitionProgress = 0;
        this.transitionDirection = 0;
        this.animTime = 0;
        
        // Book page turn animation
        this.pageFlipProgress = 0;
        this.isFlipping = false;
        this.flipDirection = 0;
    }
    
    setSoundManager(soundManager) {
        this.soundManager = soundManager;
    }
    
    handleClick(x, y) {
        const centerY = this.canvas.height / 2;
        const arrowY = centerY - 30;
        const arrowSize = 50;
        
        // Left arrow / previous page
        if (x >= 50 && x <= 50 + arrowSize && 
            y >= arrowY && y <= arrowY + 60) {
            this.previousClass();
            return;
        }
        
        // Right arrow / next page
        if (x >= this.canvas.width - 100 && x <= this.canvas.width - 50 &&
            y >= arrowY && y <= arrowY + 60) {
            this.nextClass();
            return;
        }
        
        // Select button
        const buttonY = this.canvas.height - 120;
        const buttonX = this.canvas.width / 2 - 100;
        if (x >= buttonX && x <= buttonX + 200 &&
            y >= buttonY && y <= buttonY + 50) {
            this.selectCurrentClass();
        }
    }
    
    handleHover(x, y) {
        const centerY = this.canvas.height / 2;
        const arrowY = centerY - 30;
        const arrowSize = 50;
        
        this.hoverLeft = x >= 50 && x <= 50 + arrowSize && 
                         y >= arrowY && y <= arrowY + 60;
        this.hoverRight = x >= this.canvas.width - 100 && x <= this.canvas.width - 50 &&
                          y >= arrowY && y <= arrowY + 60;
        
        const buttonY = this.canvas.height - 120;
        const buttonX = this.canvas.width / 2 - 100;
        this.hoverButton = x >= buttonX && x <= buttonX + 200 &&
                           y >= buttonY && y <= buttonY + 50;
    }
    
    previousClass() {
        if (this.isFlipping) return;
        this.currentIndex = (this.currentIndex - 1 + this.classNames.length) % this.classNames.length;
        
        // Play page turn sound
        if (this.soundManager && this.soundManager.play) {
            this.soundManager.play('pageTurn', 0.5);
        }
    }
    
    nextClass() {
        if (this.isFlipping) return;
        this.currentIndex = (this.currentIndex + 1) % this.classNames.length;
        
        // Play page turn sound
        if (this.soundManager && this.soundManager.play) {
            this.soundManager.play('pageTurn', 0.5);
        }
    }
    
    selectCurrentClass() {
        const className = this.classNames[this.currentIndex];
        this.selectedClass = className;
        if (this.onSelect) {
            this.onSelect(className);
        }
    }
    
    // Helper to lighten a color
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `rgb(${R}, ${G}, ${B})`;
    }
    
    render(ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.animTime = Date.now() / 1000;
        
        // ===== BRICK WALL BACKGROUND =====
        this.renderBrickBackground(ctx, w, h);
        
        // Decorative elements - rain/deluge effect
        ctx.save();
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < 60; i++) {
            const x = (Date.now() / 8 + i * 37) % w;
            const y = (Date.now() / 4 + i * 23) % h;
            ctx.strokeStyle = '#4488ff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 8, y + 30);
            ctx.stroke();
        }
        ctx.restore();
        
        // Dark overlay for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, w, h);
        
        // Subtitle removed per request
        
        // Current class display
        const currentClassName = this.classNames[this.currentIndex];
        const classData = this.classes[currentClassName];
        
        // ===== BOOK-STYLE CARD =====
        this.renderBookCard(ctx, w, h, classData);
        
        // Navigation arrows (book page corners)
        const arrowY = h / 2 - 30;
        
        // Left page turn
        ctx.fillStyle = this.hoverLeft ? '#ddd' : '#aaa';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('◄', 75, arrowY + 35);
        
        // Right page turn
        ctx.fillStyle = this.hoverRight ? '#ddd' : '#aaa';
        ctx.fillText('►', w - 75, arrowY + 35);
        
        // Class indicator dots (no page number since it loops)
        ctx.fillStyle = '#8b7355';
        const dotSpacing = 20;
        const dotsStartX = w / 2 - ((this.classNames.length - 1) * dotSpacing) / 2;
        for (let i = 0; i < this.classNames.length; i++) {
            ctx.beginPath();
            ctx.arc(dotsStartX + i * dotSpacing, h - 150, i === this.currentIndex ? 6 : 4, 0, Math.PI * 2);
            ctx.fillStyle = i === this.currentIndex ? '#5a4a3a' : '#b4a498';
            ctx.fill();
        }
        
        // Select button - "DESCEND"
        const buttonY = h - 120;
        const buttonX = w / 2 - 100;
        
        ctx.fillStyle = this.hoverButton ? classData.color || '#4488ff' : '#2a2a4a';
        ctx.beginPath();
        ctx.roundRect(buttonX, buttonY, 200, 50, 10);
        ctx.fill();
        
        ctx.strokeStyle = classData.color || '#4488ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(buttonX, buttonY, 200, 50, 10);
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('DESCEND', w / 2, buttonY + 32);
        
        ctx.textAlign = 'left';
    }
    
    renderBrickBackground(ctx, w, h) {
        // Dark purple brick wall colors
        const mortarColor = '#1a0a1a';
        const brickWidth = 64;
        const brickHeight = 32;
        const mortarWidth = 4;
        
        // Fill with dark mortar
        ctx.fillStyle = mortarColor;
        ctx.fillRect(0, 0, w, h);
        
        // Draw dark purple bricks
        for (let row = 0; row < Math.ceil(h / brickHeight) + 1; row++) {
            const offset = (row % 2) * (brickWidth / 2);
            
            for (let col = -1; col < Math.ceil(w / brickWidth) + 1; col++) {
                const x = col * brickWidth + offset;
                const y = row * brickHeight;
                
                // Slight color variation for each brick
                const variation = Math.sin(row * 3.7 + col * 2.3) * 15;
                const r = 90 + variation;
                const g = 74 + variation * 0.8;
                const b = 58 + variation * 0.6;
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(
                    x + mortarWidth / 2, 
                    y + mortarWidth / 2, 
                    brickWidth - mortarWidth, 
                    brickHeight - mortarWidth
                );
                
                // Brick highlight (top edge)
                ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
                ctx.fillRect(
                    x + mortarWidth / 2, 
                    y + mortarWidth / 2, 
                    brickWidth - mortarWidth, 
                    3
                );
                
                // Brick shadow (bottom edge)
                ctx.fillStyle = `rgba(0, 0, 0, 0.2)`;
                ctx.fillRect(
                    x + mortarWidth / 2, 
                    y + brickHeight - mortarWidth / 2 - 3, 
                    brickWidth - mortarWidth, 
                    3
                );
            }
        }
    }
    
    renderBookCard(ctx, w, h, classData) {
        // Book dimensions - wider for side-by-side layout
        const bookW = 600;
        const bookH = 420;
        const bookX = w / 2 - bookW / 2;
        const bookY = 140;
        
        // Book shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(bookX + 10, bookY + 10, bookW, bookH, 5);
        ctx.fill();
        
        // Book cover (aged paper look)
        const gradient = ctx.createLinearGradient(bookX, bookY, bookX + bookW, bookY);
        gradient.addColorStop(0, '#d4c4a8');
        gradient.addColorStop(0.5, '#e8dcc8');
        gradient.addColorStop(1, '#d4c4a8');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(bookX, bookY, bookW, bookH, 5);
        ctx.fill();
        
        // Book spine (center line)
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(w / 2, bookY + 10);
        ctx.lineTo(w / 2, bookY + bookH - 10);
        ctx.stroke();
        
        // Book border
        ctx.strokeStyle = '#6b5344';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(bookX, bookY, bookW, bookH, 5);
        ctx.stroke();
        
        // === LEFT PAGE: Player sprite and info ===
        const leftPageX = bookX + 30;
        const leftPageW = bookW / 2 - 50;
        
        // Class name header
        ctx.fillStyle = '#3a2a1a';
        ctx.font = 'bold 28px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(classData.name, leftPageX + leftPageW / 2, bookY + 50);
        
        // Decorative line under name
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftPageX + 20, bookY + 65);
        ctx.lineTo(leftPageX + leftPageW - 20, bookY + 65);
        ctx.stroke();
        
        // Player sprite with animated eyes
        const spriteX = leftPageX + leftPageW / 2;
        const spriteY = bookY + 150;
        this.renderPlayerSprite(ctx, spriteX, spriteY, classData);
        
        // Description
        ctx.fillStyle = '#4a3a2a';
        ctx.font = '13px Georgia';
        ctx.textAlign = 'center';
        const desc = classData.description || '';
        this.wrapText(ctx, desc, spriteX, bookY + 260, leftPageW - 20, 18);
        
        // Movement and weapons
        ctx.font = '11px Georgia';
        ctx.fillStyle = '#5a4a3a';
        let movement = [];
        if (classData.canSprint) movement.push('Sprint');
        if (classData.canDash) movement.push('Dash');
        if (classData.canTeleport) movement.push('Teleport');
        ctx.fillText('Movement: ' + (movement.join(', ') || 'Standard'), spriteX, bookY + bookH - 60);
        ctx.fillText('Weapons: ' + (classData.weaponTypes?.slice(0, 3).join(', ') || 'None'), spriteX, bookY + bookH - 40);
        
        // === RIGHT PAGE: Stats ===
        const rightPageX = w / 2 + 20;
        const rightPageW = bookW / 2 - 50;
        
        // Stats header
        ctx.fillStyle = '#3a2a1a';
        ctx.font = 'bold 20px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Attributes', rightPageX + rightPageW / 2, bookY + 50);
        
        // Stats display
        const statsY = bookY + 90;
        ctx.font = '14px Georgia';
        ctx.textAlign = 'left';
        
        const stats = classData.baseStats;
        const statLabels = [
            { label: 'Strength', value: stats.strength, color: '#cc4444' },
            { label: 'Agility', value: stats.agility, color: '#44cc44' },
            { label: 'Intelligence', value: stats.intelligence, color: '#4444cc' },
            { label: 'Vitality', value: stats.vitality, color: '#cc8844' },
            { label: 'Luck', value: stats.luck, color: '#cc44cc' }
        ];
        
        const statBarWidth = 120;
        const statX = rightPageX + 20;
        
        statLabels.forEach((stat, i) => {
            const y = statsY + i * 45;
            
            // Stat label
            ctx.fillStyle = '#4a3a2a';
            ctx.font = '13px Georgia';
            ctx.textAlign = 'left';
            ctx.fillText(stat.label, statX, y);
            
            // Stat bar background
            ctx.fillStyle = '#c4b4a0';
            ctx.fillRect(statX, y + 6, statBarWidth, 14);
            
            // Stat bar fill
            ctx.fillStyle = stat.color;
            ctx.fillRect(statX, y + 6, (stat.value / 20) * statBarWidth, 14);
            
            // Stat bar border
            ctx.strokeStyle = '#8b7355';
            ctx.lineWidth = 1;
            ctx.strokeRect(statX, y + 6, statBarWidth, 14);
            
            // Value
            ctx.fillStyle = '#2a1a0a';
            ctx.font = 'bold 13px Georgia';
            ctx.fillText(stat.value.toString(), statX + statBarWidth + 8, y + 16);
        });
        
        // Abilities preview - positioned below stats with proper spacing
        const abilitiesY = statsY + statLabels.length * 45 + 20;
        ctx.fillStyle = '#3a2a1a';
        ctx.font = 'bold 14px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Abilities', rightPageX + rightPageW / 2, abilitiesY);
        
        ctx.font = '11px Georgia';
        ctx.fillStyle = '#5a4a3a';
        const abilities = classData.abilities || [];
        for (let i = 0; i < Math.min(2, abilities.length); i++) {
            ctx.fillText('- ' + abilities[i].name, rightPageX + rightPageW / 2, abilitiesY + 18 + i * 16);
        }
        
        ctx.textAlign = 'left';
    }
    
    renderPlayerSprite(ctx, x, y, classData) {
        const size = 64;
        const time = this.animTime;
        const baseColor = classData.color || '#4488ff';
        
        // Idle bob animation
        const bobOffset = Math.sin(time * 2) * 3;
        
        ctx.save();
        ctx.translate(x, y + bobOffset);
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, size / 2 + 5, size / 2, size / 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Body
        ctx.fillStyle = baseColor;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        
        // Inner body detail
        ctx.fillStyle = this.lightenColor(baseColor, 20);
        ctx.fillRect(-size / 2 + 6, -size / 2 + 6, size - 12, size / 2 - 6);
        
        // Animated eyes that look around
        const eyeX = Math.sin(time * 0.7) * 4;
        const eyeY = Math.cos(time * 0.5) * 2;
        
        // Eye whites
        ctx.fillStyle = '#fff';
        ctx.fillRect(-12 + eyeX, -8 + eyeY, 10, 10);
        ctx.fillRect(4 + eyeX, -8 + eyeY, 10, 10);
        
        // Pupils
        ctx.fillStyle = '#111';
        ctx.fillRect(-10 + eyeX + Math.sin(time) * 2, -6 + eyeY + Math.cos(time * 0.8) * 1, 6, 6);
        ctx.fillRect(6 + eyeX + Math.sin(time) * 2, -6 + eyeY + Math.cos(time * 0.8) * 1, 6, 6);
        
        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.fillRect(-9 + eyeX + Math.sin(time) * 2, -5 + eyeY, 2, 2);
        ctx.fillRect(7 + eyeX + Math.sin(time) * 2, -5 + eyeY, 2, 2);
        
        // Render class-specific hat/prop
        this.renderClassHat(ctx, classData, size, time);
        
        // Class indicator border
        ctx.strokeStyle = this.lightenColor(baseColor, 40);
        ctx.lineWidth = 3;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        
        ctx.restore();
    }
    
    // Render class-specific hats and props
    renderClassHat(ctx, classData, size, time) {
        const className = classData.name?.toLowerCase() || '';
        const halfSize = size / 2;
        
        switch(className) {
            case 'knight':
                // Knight helmet with visor
                ctx.fillStyle = '#666';
                ctx.fillRect(-halfSize + 4, -halfSize - 16, size - 8, 18);
                ctx.fillStyle = '#888';
                ctx.fillRect(-halfSize + 6, -halfSize - 14, size - 12, 8);
                // Visor slit
                ctx.fillStyle = '#222';
                ctx.fillRect(-halfSize + 10, -halfSize - 10, size - 20, 4);
                // Plume
                ctx.fillStyle = '#cc3333';
                ctx.fillRect(-4, -halfSize - 26, 8, 12);
                ctx.fillRect(-2, -halfSize - 30, 4, 6);
                break;
                
            case 'viking':
                // Horned helmet
                ctx.fillStyle = '#8b7355';
                ctx.fillRect(-halfSize + 2, -halfSize - 12, size - 4, 14);
                // Horns
                ctx.fillStyle = '#f5deb3';
                ctx.beginPath();
                ctx.moveTo(-halfSize - 4, -halfSize - 8);
                ctx.lineTo(-halfSize + 8, -halfSize - 4);
                ctx.lineTo(-halfSize + 4, -halfSize + 4);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(halfSize + 4, -halfSize - 8);
                ctx.lineTo(halfSize - 8, -halfSize - 4);
                ctx.lineTo(halfSize - 4, -halfSize + 4);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'samurai':
                // Kabuto helmet
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(-halfSize + 2, -halfSize - 10, size - 4, 12);
                // Crest
                ctx.fillStyle = '#gold';
                ctx.beginPath();
                ctx.moveTo(0, -halfSize - 20);
                ctx.lineTo(-12, -halfSize - 6);
                ctx.lineTo(12, -halfSize - 6);
                ctx.closePath();
                ctx.fill();
                // Side flaps
                ctx.fillStyle = '#2a2a3e';
                ctx.fillRect(-halfSize - 4, -halfSize - 4, 8, 12);
                ctx.fillRect(halfSize - 4, -halfSize - 4, 8, 12);
                break;
                
            case 'assassin':
                // Hood
                ctx.fillStyle = '#2a2a2a';
                ctx.beginPath();
                ctx.moveTo(0, -halfSize - 18);
                ctx.lineTo(-halfSize - 2, -halfSize + 6);
                ctx.lineTo(halfSize + 2, -halfSize + 6);
                ctx.closePath();
                ctx.fill();
                // Shadow under hood
                ctx.fillStyle = '#111';
                ctx.fillRect(-halfSize + 6, -halfSize - 2, size - 12, 8);
                break;
                
            case 'ninja':
                // Ninja headband
                ctx.fillStyle = '#333';
                ctx.fillRect(-halfSize - 2, -halfSize - 8, size + 4, 10);
                // Metal plate
                ctx.fillStyle = '#888';
                ctx.fillRect(-8, -halfSize - 6, 16, 6);
                // Headband tails
                ctx.fillStyle = '#333';
                ctx.fillRect(halfSize, -halfSize - 6, 12, 4);
                ctx.fillRect(halfSize + 8, -halfSize - 4, 8, 4);
                break;
                
            case 'archer':
                // Feathered cap
                ctx.fillStyle = '#228b22';
                ctx.beginPath();
                ctx.moveTo(-halfSize + 4, -halfSize - 2);
                ctx.lineTo(0, -halfSize - 14);
                ctx.lineTo(halfSize - 4, -halfSize - 2);
                ctx.closePath();
                ctx.fill();
                // Feather
                ctx.fillStyle = '#ff6347';
                ctx.beginPath();
                ctx.moveTo(halfSize - 8, -halfSize - 4);
                ctx.lineTo(halfSize + 6, -halfSize - 20);
                ctx.lineTo(halfSize - 2, -halfSize - 6);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'musketeer':
                // Wide-brimmed hat with feather
                ctx.fillStyle = '#4a3728';
                ctx.fillRect(-halfSize - 8, -halfSize - 8, size + 16, 8);
                ctx.fillRect(-halfSize + 4, -halfSize - 18, size - 8, 12);
                // Feather plume
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.moveTo(halfSize - 6, -halfSize - 14);
                ctx.quadraticCurveTo(halfSize + 10, -halfSize - 30, halfSize - 2, -halfSize - 8);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'mage':
                // Wizard hat
                ctx.fillStyle = '#4169e1';
                ctx.beginPath();
                ctx.moveTo(0, -halfSize - 32);
                ctx.lineTo(-halfSize - 4, -halfSize - 2);
                ctx.lineTo(halfSize + 4, -halfSize - 2);
                ctx.closePath();
                ctx.fill();
                // Hat brim
                ctx.fillStyle = '#3a5fcd';
                ctx.fillRect(-halfSize - 6, -halfSize - 4, size + 12, 6);
                // Star decoration
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(-2 + Math.sin(time) * 2, -halfSize - 18, 4, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'arcmage':
                // Grand wizard hat with gems
                ctx.fillStyle = '#800080';
                ctx.beginPath();
                ctx.moveTo(0, -halfSize - 38);
                ctx.lineTo(-halfSize - 6, -halfSize - 2);
                ctx.lineTo(halfSize + 6, -halfSize - 2);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#9932cc';
                ctx.fillRect(-halfSize - 8, -halfSize - 4, size + 16, 6);
                // Glowing gems
                const gemGlow = 0.5 + Math.sin(time * 3) * 0.5;
                ctx.fillStyle = `rgba(0, 255, 255, ${gemGlow})`;
                ctx.beginPath();
                ctx.arc(0, -halfSize - 22, 5, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'darkmage':
                // Dark hood with horns
                ctx.fillStyle = '#1a0a1a';
                ctx.beginPath();
                ctx.moveTo(0, -halfSize - 24);
                ctx.lineTo(-halfSize - 2, -halfSize + 4);
                ctx.lineTo(halfSize + 2, -halfSize + 4);
                ctx.closePath();
                ctx.fill();
                // Small horns
                ctx.fillStyle = '#330033';
                ctx.beginPath();
                ctx.moveTo(-halfSize + 6, -halfSize - 12);
                ctx.lineTo(-halfSize - 2, -halfSize - 24);
                ctx.lineTo(-halfSize + 10, -halfSize - 8);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(halfSize - 6, -halfSize - 12);
                ctx.lineTo(halfSize + 2, -halfSize - 24);
                ctx.lineTo(halfSize - 10, -halfSize - 8);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'necromancer':
                // Skull crown
                ctx.fillStyle = '#f0f0f0';
                ctx.beginPath();
                ctx.arc(0, -halfSize - 12, 12, Math.PI, 0);
                ctx.fill();
                ctx.fillRect(-12, -halfSize - 12, 24, 8);
                // Eye sockets
                ctx.fillStyle = '#300';
                ctx.beginPath();
                ctx.arc(-5, -halfSize - 12, 4, 0, Math.PI * 2);
                ctx.arc(5, -halfSize - 12, 4, 0, Math.PI * 2);
                ctx.fill();
                // Glowing eyes
                const eyePulse = 0.3 + Math.sin(time * 4) * 0.7;
                ctx.fillStyle = `rgba(255, 0, 100, ${eyePulse})`;
                ctx.beginPath();
                ctx.arc(-5, -halfSize - 12, 2, 0, Math.PI * 2);
                ctx.arc(5, -halfSize - 12, 2, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'priest':
                // Holy halo
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 3;
                const haloGlow = 0.6 + Math.sin(time * 2) * 0.4;
                ctx.globalAlpha = haloGlow;
                ctx.beginPath();
                ctx.ellipse(0, -halfSize - 16, 18, 6, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                // Small cross
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(-2, -halfSize - 24, 4, 12);
                ctx.fillRect(-6, -halfSize - 20, 12, 4);
                break;
                
            case 'magical knight':
            case 'magicalknight':
                // Enchanted knight helmet
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(-halfSize + 4, -halfSize - 14, size - 8, 16);
                ctx.fillStyle = '#5a6578';
                ctx.fillRect(-halfSize + 6, -halfSize - 12, size - 12, 8);
                // Magic runes
                const runeGlow = 0.5 + Math.sin(time * 3) * 0.5;
                ctx.strokeStyle = `rgba(100, 200, 255, ${runeGlow})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(-halfSize + 8, -halfSize - 10, size - 16, 6);
                // Enchanted plume
                ctx.fillStyle = `rgba(100, 200, 255, ${0.7 + Math.sin(time * 2) * 0.3})`;
                ctx.fillRect(-3, -halfSize - 24, 6, 12);
                break;
        }
    }
    
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let lineY = y;
        
        for (const word of words) {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && line !== '') {
                ctx.fillText(line.trim(), x, lineY);
                line = word + ' ';
                lineY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line.trim(), x, lineY);
    }
}

export default UIManager;
