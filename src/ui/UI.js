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
    }
    
    setPlayer(player) {
        this.player = player;
    }
    
    render(ctx) {
        if (!this.player) return;
        
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
        
        // Minimap content would be rendered by the game scene
        // This just draws the frame
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
    }
    
    show() {
        this.visible = true;
    }
    
    hide() {
        this.visible = false;
    }
    
    toggle() {
        this.visible = !this.visible;
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
        
        // Darken background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Panel
        const panelX = this.canvas.width / 2 - 300;
        const panelY = 50;
        const panelW = 600;
        const panelH = this.canvas.height - 100;
        
        ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.character.className} Skill Tree`, this.canvas.width / 2, panelY + 35);
        
        // Skill points
        ctx.font = '16px Arial';
        ctx.fillStyle = '#aaffaa';
        ctx.fillText(`Skill Points: ${this.character.skillPoints}`, this.canvas.width / 2, panelY + 60);
        
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
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Tier ${tierIndex + 1}`, panelX + 10, tierY + 10);
            
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
        
        // Skill tooltip
        if (this.hoveredSkill) {
            this.renderTooltip(ctx, this.hoveredSkill);
        }
        
        // Close hint
        ctx.fillStyle = '#888';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press K to close', this.canvas.width / 2, this.canvas.height - 30);
        
        ctx.textAlign = 'left';
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
        
        // Background
        if (isUnlocked) {
            ctx.fillStyle = '#2a4a2a';
        } else if (canUnlock) {
            ctx.fillStyle = '#3a3a2a';
        } else {
            ctx.fillStyle = '#2a2a2a';
        }
        ctx.fillRect(x, y, size, size);
        
        // Icon placeholder
        ctx.fillStyle = isUnlocked ? '#4a8a4a' : (canUnlock ? '#6a6a3a' : '#4a4a4a');
        ctx.fillRect(x + 5, y + 5, size - 10, size - 25);
        
        // Type indicator
        ctx.fillStyle = skill.type === 'ability' ? '#5588ff' : '#88ff55';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(skill.type === 'ability' ? 'ACT' : 'PAS', x + size/2, y + size/2 - 5);
        
        // Name
        ctx.fillStyle = '#fff';
        ctx.font = '9px Arial';
        const shortName = skill.name.length > 10 ? skill.name.substring(0, 9) + '..' : skill.name;
        ctx.fillText(shortName, x + size/2, y + size - 5);
        
        // Border
        ctx.strokeStyle = isHovered ? '#fff' : (isUnlocked ? '#4a4' : (canUnlock ? '#aa4' : '#444'));
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.strokeRect(x, y, size, size);
        
        ctx.textAlign = 'left';
    }
    
    renderTooltip(ctx, skill) {
        const tooltipW = 250;
        const tooltipH = 150;
        const x = Math.min(this.canvas.width - tooltipW - 20, this.canvas.width / 2 + 50);
        const y = 200;
        
        // Background
        ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
        ctx.fillRect(x, y, tooltipW, tooltipH);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tooltipW, tooltipH);
        
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(skill.name, x + 10, y + 20);
        
        // Type and tier
        ctx.fillStyle = '#888';
        ctx.font = '11px Arial';
        ctx.fillText(`${skill.type === 'ability' ? 'Active' : 'Passive'} - Tier ${skill.tier}`, x + 10, y + 38);
        
        // Level requirement
        if (skill.levelRequired) {
            ctx.fillStyle = this.character.level >= skill.levelRequired ? '#4a4' : '#a44';
            ctx.fillText(`Requires Level ${skill.levelRequired}`, x + 10, y + 55);
        }
        
        // Description
        ctx.fillStyle = '#ccc';
        ctx.font = '11px Arial';
        this.wrapText(ctx, skill.description, x + 10, y + 75, tooltipW - 20, 14);
        
        // Status
        const isUnlocked = this.character.unlockedSkills.has(skill.id);
        const canUnlock = this.skillTree.canUnlock(skill.id, this.character.unlockedSkills, this.character.level, this.character.skillPoints);
        
        ctx.font = 'bold 12px Arial';
        if (isUnlocked) {
            ctx.fillStyle = '#4a4';
            ctx.fillText('UNLOCKED', x + 10, y + tooltipH - 10);
        } else if (canUnlock) {
            ctx.fillStyle = '#aa4';
            ctx.fillText('Click to unlock', x + 10, y + tooltipH - 10);
        } else {
            ctx.fillStyle = '#666';
            ctx.fillText('Locked', x + 10, y + tooltipH - 10);
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
        this.selectedSlot = -1;
        this.hoveredSlot = -1;
    }
    
    toggle() {
        this.visible = !this.visible;
    }
    
    render(ctx) {
        if (!this.visible) return;
        
        // Darken background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Panel
        const panelW = 400;
        const panelH = 500;
        const panelX = this.canvas.width / 2 - panelW / 2;
        const panelY = this.canvas.height / 2 - panelH / 2;
        
        ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Inventory', this.canvas.width / 2, panelY + 30);
        
        // Equipment slots
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Equipment', panelX + 20, panelY + 60);
        
        const equipSlots = ['weapon', 'armor', 'helmet', 'boots', 'accessory1', 'accessory2'];
        const slotSize = 50;
        
        for (let i = 0; i < equipSlots.length; i++) {
            const slot = equipSlots[i];
            const item = this.character.equipment[slot];
            const x = panelX + 20 + (i % 3) * (slotSize + 10);
            const y = panelY + 80 + Math.floor(i / 3) * (slotSize + 10);
            
            // Slot background
            ctx.fillStyle = item ? '#3a3a3a' : '#2a2a2a';
            ctx.fillRect(x, y, slotSize, slotSize);
            
            // Slot label
            ctx.fillStyle = '#666';
            ctx.font = '8px Arial';
            ctx.fillText(slot, x + 2, y + 10);
            
            // Item
            if (item) {
                ctx.fillStyle = item.color || '#fff';
                ctx.fillRect(x + 5, y + 15, slotSize - 10, slotSize - 20);
            }
            
            ctx.strokeStyle = '#444';
            ctx.strokeRect(x, y, slotSize, slotSize);
        }
        
        // Inventory grid
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText('Items', panelX + 20, panelY + 210);
        
        const gridCols = 5;
        const gridRows = 4;
        
        for (let i = 0; i < gridCols * gridRows; i++) {
            const item = this.character.inventory[i];
            const x = panelX + 20 + (i % gridCols) * (slotSize + 5);
            const y = panelY + 230 + Math.floor(i / gridCols) * (slotSize + 5);
            
            // Slot background
            ctx.fillStyle = item ? '#3a3a3a' : '#2a2a2a';
            ctx.fillRect(x, y, slotSize, slotSize);
            
            // Item
            if (item) {
                ctx.fillStyle = item.color || '#fff';
                ctx.fillRect(x + 5, y + 5, slotSize - 10, slotSize - 10);
                
                // Item name
                ctx.fillStyle = '#fff';
                ctx.font = '7px Arial';
                ctx.fillText(item.name?.substring(0, 6) || '?', x + 2, y + slotSize - 3);
            }
            
            // Border
            ctx.strokeStyle = i === this.hoveredSlot ? '#fff' : '#444';
            ctx.strokeRect(x, y, slotSize, slotSize);
        }
        
        // Gold display
        ctx.fillStyle = '#ffcc00';
        ctx.font = '16px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Gold: ${this.character.gold || 0}`, panelX + panelW - 20, panelY + panelH - 20);
        
        // Close hint
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press I to close', this.canvas.width / 2, panelY + panelH - 10);
        
        ctx.textAlign = 'left';
    }
}

// Class Selection Screen
export class ClassSelectionUI {
    constructor(canvas, classes, onSelect) {
        this.canvas = canvas;
        this.classes = classes;
        this.onSelect = onSelect;
        this.selectedClass = null;
        this.hoveredClass = null;
    }
    
    handleClick(x, y) {
        const classIndex = this.getClassAtPosition(x, y);
        if (classIndex !== -1) {
            const classNames = Object.keys(this.classes);
            this.selectedClass = classNames[classIndex];
            if (this.onSelect) {
                this.onSelect(this.selectedClass);
            }
        }
    }
    
    handleHover(x, y) {
        const classIndex = this.getClassAtPosition(x, y);
        if (classIndex !== -1) {
            const classNames = Object.keys(this.classes);
            this.hoveredClass = classNames[classIndex];
        } else {
            this.hoveredClass = null;
        }
    }
    
    getClassAtPosition(x, y) {
        const classNames = Object.keys(this.classes);
        const cols = 4;
        const cardW = 150;
        const cardH = 180;
        const gap = 20;
        const startX = (this.canvas.width - (cols * cardW + (cols - 1) * gap)) / 2;
        const startY = 150;
        
        for (let i = 0; i < classNames.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cardX = startX + col * (cardW + gap);
            const cardY = startY + row * (cardH + gap);
            
            if (x >= cardX && x <= cardX + cardW &&
                y >= cardY && y <= cardY + cardH) {
                return i;
            }
        }
        
        return -1;
    }
    
    render(ctx) {
        // Background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('INTO THE DELUGE', this.canvas.width / 2, 60);
        
        ctx.font = '20px Arial';
        ctx.fillStyle = '#888';
        ctx.fillText('Choose Your Class', this.canvas.width / 2, 100);
        
        // Class cards
        const classNames = Object.keys(this.classes);
        const cols = 4;
        const cardW = 150;
        const cardH = 180;
        const gap = 20;
        const startX = (this.canvas.width - (cols * cardW + (cols - 1) * gap)) / 2;
        const startY = 150;
        
        for (let i = 0; i < classNames.length; i++) {
            const className = classNames[i];
            const classData = this.classes[className];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cardX = startX + col * (cardW + gap);
            const cardY = startY + row * (cardH + gap);
            
            const isHovered = this.hoveredClass === className;
            
            // Card background
            ctx.fillStyle = isHovered ? '#3a3a4a' : '#2a2a3a';
            ctx.fillRect(cardX, cardY, cardW, cardH);
            
            // Class color indicator
            ctx.fillStyle = classData.color || '#666';
            ctx.fillRect(cardX, cardY, cardW, 5);
            
            // Class icon placeholder
            ctx.fillStyle = classData.color || '#666';
            ctx.fillRect(cardX + cardW/2 - 25, cardY + 25, 50, 50);
            
            // Class name
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(classData.name, cardX + cardW/2, cardY + 95);
            
            // Brief description
            ctx.fillStyle = '#888';
            ctx.font = '10px Arial';
            const desc = classData.description?.substring(0, 50) + '...' || '';
            ctx.fillText(desc.substring(0, 25), cardX + cardW/2, cardY + 115);
            ctx.fillText(desc.substring(25, 50), cardX + cardW/2, cardY + 130);
            
            // Stats preview
            ctx.font = '9px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'left';
            ctx.fillText(`STR: ${classData.baseStats.strength}`, cardX + 10, cardY + 150);
            ctx.fillText(`AGI: ${classData.baseStats.agility}`, cardX + 55, cardY + 150);
            ctx.fillText(`INT: ${classData.baseStats.intelligence}`, cardX + 100, cardY + 150);
            ctx.fillText(`VIT: ${classData.baseStats.vitality}`, cardX + 10, cardY + 165);
            ctx.fillText(`LCK: ${classData.baseStats.luck}`, cardX + 55, cardY + 165);
            
            // Border
            ctx.strokeStyle = isHovered ? '#fff' : '#444';
            ctx.lineWidth = isHovered ? 2 : 1;
            ctx.strokeRect(cardX, cardY, cardW, cardH);
        }
        
        // Hovered class details
        if (this.hoveredClass) {
            this.renderClassDetails(ctx, this.classes[this.hoveredClass]);
        }
        
        ctx.textAlign = 'left';
    }
    
    renderClassDetails(ctx, classData) {
        const panelX = this.canvas.width / 2 - 250;
        const panelY = this.canvas.height - 180;
        const panelW = 500;
        const panelH = 150;
        
        ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = classData.color || '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(classData.name, panelX + 15, panelY + 25);
        
        ctx.fillStyle = '#ccc';
        ctx.font = '12px Arial';
        ctx.fillText(classData.description || '', panelX + 15, panelY + 50);
        
        // Movement style
        ctx.fillStyle = '#aaa';
        ctx.fillText('Movement: ', panelX + 15, panelY + 75);
        ctx.fillStyle = '#8af';
        let movement = [];
        if (classData.canSprint) movement.push('Sprint');
        if (classData.canDash) movement.push(`Dash (${classData.dashDistance})`);
        if (classData.canTeleport) movement.push(`Teleport (${classData.teleportDistance})`);
        ctx.fillText(movement.join(', ') || 'Standard', panelX + 85, panelY + 75);
        
        // Weapon types
        ctx.fillStyle = '#aaa';
        ctx.fillText('Weapons: ', panelX + 15, panelY + 95);
        ctx.fillStyle = '#fa8';
        ctx.fillText(classData.weaponTypes?.join(', ') || 'None', panelX + 75, panelY + 95);
        
        // Starting abilities
        ctx.fillStyle = '#aaa';
        ctx.fillText('Abilities: ', panelX + 15, panelY + 115);
        ctx.fillStyle = '#8fa';
        const abilities = classData.abilities?.map(a => a.name).slice(0, 3).join(', ') || 'None';
        ctx.fillText(abilities, panelX + 75, panelY + 115);
        
        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Click to select', panelX + panelW / 2, panelY + panelH - 15);
    }
}

export default UIManager;
