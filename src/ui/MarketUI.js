/**
 * Market UI - Handles all market-related UI rendering and interactions
 */

import { BUILDING_TYPES, NPC_TYPES, FortuneReading } from '../market/Market.js';

export class MarketUI {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.activePanel = null;
        this.selectedItem = null;
        this.hoveredItem = null;
        this.dialogueText = "";
        this.dialogueTimer = 0;
        this.fortuneReading = null;
    }
    
    // Open shop panel
    openShop(building, player) {
        this.activePanel = {
            type: 'shop',
            building: building,
            player: player,
            scroll: 0
        };
    }
    
    // Open fortune teller panel
    openFortuneTeller(player, nextFloor) {
        this.fortuneReading = new FortuneReading(player, nextFloor);
        this.activePanel = {
            type: 'fortune',
            reading: this.fortuneReading
        };
    }
    
    // Open mercenary hire panel
    openMercenaryPanel(building, player) {
        this.activePanel = {
            type: 'mercenary',
            building: building,
            player: player
        };
    }
    
    // Open arena panel
    openArenaPanel(challenge, player) {
        this.activePanel = {
            type: 'arena',
            challenge: challenge,
            player: player
        };
    }
    
    // Open guild panel
    openGuildPanel(quests, player) {
        this.activePanel = {
            type: 'guild',
            quests: quests,
            player: player
        };
    }
    
    // Close active panel
    closePanel() {
        this.activePanel = null;
        this.selectedItem = null;
        this.hoveredItem = null;
    }
    
    // Show dialogue bubble
    showDialogue(text, duration = 3) {
        this.dialogueText = text;
        this.dialogueTimer = duration;
    }
    
    update(dt) {
        if (this.dialogueTimer > 0) {
            this.dialogueTimer -= dt;
            if (this.dialogueTimer <= 0) {
                this.dialogueText = "";
            }
        }
    }
    
    handleClick(x, y, player, soundManager) {
        if (!this.activePanel) return false;
        
        const panelW = 500;
        const panelH = 400;
        const panelX = this.canvas.width / 2 - panelW / 2;
        const panelY = this.canvas.height / 2 - panelH / 2;
        
        // Close button
        if (x >= panelX + panelW - 30 && x <= panelX + panelW - 10 &&
            y >= panelY + 10 && y <= panelY + 30) {
            this.closePanel();
            return true;
        }
        
        switch (this.activePanel.type) {
            case 'shop':
                return this.handleShopClick(x, y, panelX, panelY, panelW, panelH, player, soundManager);
            case 'fortune':
                return this.handleFortuneClick(x, y, panelX, panelY, panelW, panelH);
            case 'mercenary':
                return this.handleMercenaryClick(x, y, panelX, panelY, panelW, panelH, player, soundManager);
            case 'arena':
                return this.handleArenaClick(x, y, panelX, panelY, panelW, panelH, player);
            case 'guild':
                return this.handleGuildClick(x, y, panelX, panelY, panelW, panelH, player);
        }
        
        return false;
    }
    
    handleShopClick(x, y, panelX, panelY, panelW, panelH, player, soundManager) {
        const building = this.activePanel.building;
        const itemStartY = panelY + 60;
        const itemHeight = 40;
        
        for (let i = 0; i < building.inventory.length; i++) {
            const itemY = itemStartY + i * itemHeight;
            
            if (y >= itemY && y <= itemY + itemHeight - 5 && x >= panelX + 20 && x <= panelX + panelW - 20) {
                const item = building.inventory[i];
                
                // Check if player can afford
                if (player.gold >= item.price) {
                    player.gold -= item.price;
                    
                    // Add item to player inventory
                    if (item.type === 'consumable') {
                        if (!player.consumables) player.consumables = [];
                        player.consumables.push({ ...item });
                    } else {
                        if (!player.inventory) player.inventory = [];
                        player.inventory.push({ ...item });
                    }
                    
                    // Play purchase sound
                    if (soundManager) {
                        soundManager.playCoin();
                    }
                    
                    this.showDialogue("Purchase successful!");
                    return true;
                } else {
                    this.showDialogue("Not enough gold!");
                    return true;
                }
            }
        }
        
        return false;
    }
    
    handleFortuneClick(x, y, panelX, panelY, panelW, panelH) {
        // Close button handled in main handler
        return false;
    }
    
    handleMercenaryClick(x, y, panelX, panelY, panelW, panelH, player, soundManager) {
        const building = this.activePanel.building;
        if (!building.mercenaries) return false;
        
        const mercStartY = panelY + 80;
        const mercHeight = 80;
        
        for (let i = 0; i < building.mercenaries.length; i++) {
            const mercY = mercStartY + i * mercHeight;
            
            if (y >= mercY && y <= mercY + mercHeight - 10 && x >= panelX + 20 && x <= panelX + panelW - 20) {
                const merc = building.mercenaries[i];
                
                // Check if player already has a mercenary
                if (player.mercenary) {
                    this.showDialogue("You already have a companion!");
                    return true;
                }
                
                // Check if player can afford
                if (player.gold >= merc.price) {
                    player.gold -= merc.price;
                    
                    // Create and assign mercenary
                    const { Mercenary } = require('../market/Market.js');
                    player.mercenary = new Mercenary(merc, player.className);
                    player.mercenary.x = player.x - 50;
                    player.mercenary.y = player.y;
                    
                    if (soundManager) {
                        soundManager.playCoin();
                    }
                    
                    this.showDialogue(`${merc.name} joins your party!`);
                    this.closePanel();
                    return true;
                } else {
                    this.showDialogue("Not enough gold!");
                    return true;
                }
            }
        }
        
        return false;
    }
    
    handleArenaClick(x, y, panelX, panelY, panelW, panelH, player) {
        // Start arena button
        const btnX = panelX + panelW / 2 - 60;
        const btnY = panelY + panelH - 60;
        const btnW = 120;
        const btnH = 40;
        
        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
            // Signal to start arena
            return { action: 'start_arena', challenge: this.activePanel.challenge };
        }
        
        return false;
    }
    
    handleGuildClick(x, y, panelX, panelY, panelW, panelH, player) {
        const quests = this.activePanel.quests;
        const questStartY = panelY + 80;
        const questHeight = 60;
        
        for (let i = 0; i < quests.length; i++) {
            const questY = questStartY + i * questHeight;
            const acceptBtnX = panelX + panelW - 100;
            
            if (y >= questY && y <= questY + questHeight - 10) {
                // Accept button
                if (x >= acceptBtnX && x <= acceptBtnX + 70) {
                    const quest = quests[i];
                    if (!player.activeQuests) player.activeQuests = [];
                    
                    if (!player.activeQuests.find(q => q.objective === quest.objective)) {
                        player.activeQuests.push(quest);
                        this.showDialogue("Quest accepted!");
                        return true;
                    } else {
                        this.showDialogue("Quest already active!");
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    handleHover(x, y) {
        if (!this.activePanel) return;
        
        const panelW = 500;
        const panelH = 400;
        const panelX = this.canvas.width / 2 - panelW / 2;
        const panelY = this.canvas.height / 2 - panelH / 2;
        
        this.hoveredItem = null;
        
        if (this.activePanel.type === 'shop') {
            const building = this.activePanel.building;
            const itemStartY = panelY + 60;
            const itemHeight = 40;
            
            for (let i = 0; i < building.inventory.length; i++) {
                const itemY = itemStartY + i * itemHeight;
                
                if (y >= itemY && y <= itemY + itemHeight - 5 && x >= panelX + 20 && x <= panelX + panelW - 20) {
                    this.hoveredItem = i;
                    break;
                }
            }
        }
    }
    
    render(ctx, camera) {
        // Render active panel
        if (this.activePanel) {
            this.renderPanel(ctx);
        }
        
        // Render dialogue bubble
        if (this.dialogueText) {
            this.renderDialogue(ctx);
        }
    }
    
    renderPanel(ctx) {
        const panelW = 500;
        const panelH = 400;
        const panelX = this.canvas.width / 2 - panelW / 2;
        const panelY = this.canvas.height / 2 - panelH / 2;
        
        // Background overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Panel background
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        
        // Panel border
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        
        // Close button
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(panelX + panelW - 30, panelY + 10, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('X', panelX + panelW - 20, panelY + 24);
        
        switch (this.activePanel.type) {
            case 'shop':
                this.renderShopPanel(ctx, panelX, panelY, panelW, panelH);
                break;
            case 'fortune':
                this.renderFortunePanel(ctx, panelX, panelY, panelW, panelH);
                break;
            case 'mercenary':
                this.renderMercenaryPanel(ctx, panelX, panelY, panelW, panelH);
                break;
            case 'arena':
                this.renderArenaPanel(ctx, panelX, panelY, panelW, panelH);
                break;
            case 'guild':
                this.renderGuildPanel(ctx, panelX, panelY, panelW, panelH);
                break;
        }
    }
    
    renderShopPanel(ctx, panelX, panelY, panelW, panelH) {
        const building = this.activePanel.building;
        const player = this.activePanel.player;
        
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(building.name, panelX + panelW / 2, panelY + 35);
        
        // Player gold
        ctx.font = '14px Georgia';
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'right';
        ctx.fillText(`Gold: ${player.gold || 0}`, panelX + panelW - 40, panelY + 35);
        
        // Items
        const itemStartY = panelY + 60;
        const itemHeight = 40;
        
        ctx.textAlign = 'left';
        for (let i = 0; i < building.inventory.length; i++) {
            const item = building.inventory[i];
            const itemY = itemStartY + i * itemHeight;
            
            // Item background
            const isHovered = this.hoveredItem === i;
            ctx.fillStyle = isHovered ? '#3a3a3a' : '#252525';
            ctx.fillRect(panelX + 20, itemY, panelW - 40, itemHeight - 5);
            
            // Item name
            ctx.fillStyle = this.getItemColor(item.rarity || 'common');
            ctx.font = '14px Georgia';
            ctx.fillText(item.name, panelX + 30, itemY + 22);
            
            // Item price
            const canAfford = (player.gold || 0) >= item.price;
            ctx.fillStyle = canAfford ? '#ffd700' : '#ff4444';
            ctx.textAlign = 'right';
            ctx.fillText(`${item.price}g`, panelX + panelW - 30, itemY + 22);
            ctx.textAlign = 'left';
            
            // Item stats
            ctx.fillStyle = '#888';
            ctx.font = '11px Georgia';
            if (item.damage) {
                ctx.fillText(`DMG: ${item.damage}`, panelX + 200, itemY + 22);
            } else if (item.defense) {
                ctx.fillText(`DEF: ${item.defense}`, panelX + 200, itemY + 22);
            } else if (item.effect) {
                ctx.fillText(`Effect: ${item.effect}`, panelX + 200, itemY + 22);
            }
        }
    }
    
    renderFortunePanel(ctx, panelX, panelY, panelW, panelH) {
        const reading = this.activePanel.reading;
        
        // Title
        ctx.fillStyle = '#9966cc';
        ctx.font = 'bold 22px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Fortune Reading', panelX + panelW / 2, panelY + 40);
        
        // Cards
        const cardWidth = 80;
        const cardHeight = 120;
        const cardSpacing = 30;
        const cardsStartX = panelX + (panelW - (cardWidth * 3 + cardSpacing * 2)) / 2;
        const cardsY = panelY + 60;
        
        for (let i = 0; i < reading.cards.length; i++) {
            const card = reading.cards[i];
            const cardX = cardsStartX + i * (cardWidth + cardSpacing);
            
            // Card background
            const cardColor = card.positive === true ? '#2a4a2a' : 
                             card.positive === false ? '#4a2a2a' : '#3a3a3a';
            ctx.fillStyle = cardColor;
            ctx.fillRect(cardX, cardsY, cardWidth, cardHeight);
            
            // Card border
            ctx.strokeStyle = '#9966cc';
            ctx.lineWidth = 2;
            ctx.strokeRect(cardX, cardsY, cardWidth, cardHeight);
            
            // Card name (wrapped)
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Georgia';
            ctx.textAlign = 'center';
            
            const words = card.name.split(' ');
            let y = cardsY + 50;
            for (const word of words) {
                ctx.fillText(word, cardX + cardWidth / 2, y);
                y += 14;
            }
            
            // Position label
            ctx.fillStyle = '#888';
            ctx.font = '10px Georgia';
            ctx.fillText(['Past', 'Present', 'Future'][i], cardX + cardWidth / 2, cardsY + cardHeight + 15);
        }
        
        // Interpretation
        ctx.fillStyle = '#ddd';
        ctx.font = '13px Georgia';
        ctx.textAlign = 'left';
        
        const lines = reading.interpretation.split('\n');
        let textY = cardsY + cardHeight + 45;
        for (const line of lines) {
            ctx.fillText(line, panelX + 30, textY);
            textY += 18;
        }
        
        // Success chance bar
        const barX = panelX + 30;
        const barY = panelY + panelH - 50;
        const barW = panelW - 60;
        const barH = 20;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        
        const chanceColor = reading.successChance >= 60 ? '#4a4' : 
                           reading.successChance >= 40 ? '#aa4' : '#a44';
        ctx.fillStyle = chanceColor;
        ctx.fillRect(barX, barY, barW * (reading.successChance / 100), barH);
        
        ctx.strokeStyle = '#666';
        ctx.strokeRect(barX, barY, barW, barH);
    }
    
    renderMercenaryPanel(ctx, panelX, panelY, panelW, panelH) {
        const building = this.activePanel.building;
        const player = this.activePanel.player;
        
        // Title
        ctx.fillStyle = '#CD853F';
        ctx.font = 'bold 20px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Hire a Mercenary', panelX + panelW / 2, panelY + 35);
        
        // Player gold
        ctx.font = '14px Georgia';
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'right';
        ctx.fillText(`Gold: ${player.gold || 0}`, panelX + panelW - 40, panelY + 35);
        
        if (!building.mercenaries) return;
        
        // Mercenaries
        const mercStartY = panelY + 80;
        const mercHeight = 80;
        
        for (let i = 0; i < building.mercenaries.length; i++) {
            const merc = building.mercenaries[i];
            const mercY = mercStartY + i * mercHeight;
            
            // Background
            ctx.fillStyle = '#2a2520';
            ctx.fillRect(panelX + 20, mercY, panelW - 40, mercHeight - 10);
            ctx.strokeStyle = '#5a4a3a';
            ctx.strokeRect(panelX + 20, mercY, panelW - 40, mercHeight - 10);
            
            // Class icon (colored square)
            const classColors = {
                knight: '#7899c4', mage: '#9966cc', assassin: '#444',
                viking: '#8b4513', samurai: '#dc143c', ninja: '#333',
                musketeer: '#8b7355', necromancer: '#4a0080'
            };
            ctx.fillStyle = classColors[merc.class] || '#888';
            ctx.fillRect(panelX + 30, mercY + 15, 40, 40);
            
            // Name and class
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Georgia';
            ctx.textAlign = 'left';
            ctx.fillText(`${merc.name} the ${merc.class.charAt(0).toUpperCase() + merc.class.slice(1)}`, panelX + 80, mercY + 25);
            
            // Level
            ctx.fillStyle = '#aaa';
            ctx.font = '12px Georgia';
            ctx.fillText(`Level ${merc.level}`, panelX + 80, mercY + 45);
            
            // Price
            const canAfford = (player.gold || 0) >= merc.price;
            ctx.fillStyle = canAfford ? '#ffd700' : '#ff4444';
            ctx.textAlign = 'right';
            ctx.font = 'bold 14px Georgia';
            ctx.fillText(`${merc.price}g`, panelX + panelW - 40, mercY + 35);
            
            // Hire button
            ctx.fillStyle = canAfford ? '#4a4' : '#444';
            ctx.fillRect(panelX + panelW - 100, mercY + 45, 50, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '11px Georgia';
            ctx.textAlign = 'center';
            ctx.fillText('Hire', panelX + panelW - 75, mercY + 59);
        }
        
        ctx.textAlign = 'left';
    }
    
    renderArenaPanel(ctx, panelX, panelY, panelW, panelH) {
        const challenge = this.activePanel.challenge;
        
        // Title
        ctx.fillStyle = '#8B0000';
        ctx.font = 'bold 22px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Arena Challenge', panelX + panelW / 2, panelY + 40);
        
        // Wave info
        ctx.fillStyle = '#fff';
        ctx.font = '16px Georgia';
        ctx.fillText(`${challenge.waves.length} Waves of Combat`, panelX + panelW / 2, panelY + 80);
        
        // Wave details
        ctx.font = '13px Georgia';
        ctx.fillStyle = '#aaa';
        let y = panelY + 110;
        for (let i = 0; i < challenge.waves.length; i++) {
            const wave = challenge.waves[i];
            ctx.fillText(`Wave ${i + 1}: ${wave.enemies} enemies`, panelX + panelW / 2, y);
            y += 25;
        }
        
        // Rewards
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 14px Georgia';
        ctx.fillText('Rewards:', panelX + panelW / 2, y + 20);
        
        ctx.font = '13px Georgia';
        ctx.fillText(`Gold: ${challenge.rewards.gold}`, panelX + panelW / 2, y + 45);
        ctx.fillStyle = '#88f';
        ctx.fillText(`Experience: ${challenge.rewards.exp}`, panelX + panelW / 2, y + 65);
        
        if (challenge.rewards.item) {
            ctx.fillStyle = '#a855f7';
            ctx.fillText('+ Rare Item!', panelX + panelW / 2, y + 85);
        }
        
        // Start button
        const btnX = panelX + panelW / 2 - 60;
        const btnY = panelY + panelH - 60;
        
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(btnX, btnY, 120, 40);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(btnX, btnY, 120, 40);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Georgia';
        ctx.fillText('FIGHT!', panelX + panelW / 2, btnY + 26);
    }
    
    renderGuildPanel(ctx, panelX, panelY, panelW, panelH) {
        const quests = this.activePanel.quests;
        
        // Title
        ctx.fillStyle = '#1E4D2B';
        ctx.font = 'bold 20px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText("Adventurer's Guild", panelX + panelW / 2, panelY + 35);
        
        // Subtitle
        ctx.fillStyle = '#aaa';
        ctx.font = '14px Georgia';
        ctx.fillText('Available Quests', panelX + panelW / 2, panelY + 60);
        
        // Quests
        const questStartY = panelY + 80;
        const questHeight = 70;
        
        ctx.textAlign = 'left';
        for (let i = 0; i < quests.length; i++) {
            const quest = quests[i];
            const questY = questStartY + i * questHeight;
            
            // Background
            ctx.fillStyle = '#1a2a1a';
            ctx.fillRect(panelX + 20, questY, panelW - 40, questHeight - 10);
            ctx.strokeStyle = '#3a4a3a';
            ctx.strokeRect(panelX + 20, questY, panelW - 40, questHeight - 10);
            
            // Quest objective
            ctx.fillStyle = '#fff';
            ctx.font = '14px Georgia';
            ctx.fillText(quest.objective, panelX + 30, questY + 22);
            
            // Rewards
            ctx.fillStyle = '#888';
            ctx.font = '11px Georgia';
            let rewardText = '';
            if (quest.reward.gold) rewardText += `${quest.reward.gold}g `;
            if (quest.reward.exp) rewardText += `${quest.reward.exp} XP `;
            if (quest.reward.item) rewardText += `+ ${quest.reward.item.rarity} item`;
            ctx.fillText(`Reward: ${rewardText}`, panelX + 30, questY + 42);
            
            // Accept button
            ctx.fillStyle = '#2a4a2a';
            ctx.fillRect(panelX + panelW - 100, questY + 15, 70, 30);
            ctx.fillStyle = '#fff';
            ctx.font = '12px Georgia';
            ctx.textAlign = 'center';
            ctx.fillText('Accept', panelX + panelW - 65, questY + 35);
            ctx.textAlign = 'left';
        }
    }
    
    renderDialogue(ctx) {
        const boxW = 300;
        const boxH = 60;
        const boxX = this.canvas.width / 2 - boxW / 2;
        const boxY = this.canvas.height - 100;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        
        // Text
        ctx.fillStyle = '#fff';
        ctx.font = '14px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(this.dialogueText, boxX + boxW / 2, boxY + 35);
    }
    
    getItemColor(rarity) {
        const colors = {
            common: '#ffffff',
            uncommon: '#1eff00',
            rare: '#0070dd',
            epic: '#a335ee',
            legendary: '#ff8000'
        };
        return colors[rarity] || colors.common;
    }
}

export default MarketUI;
