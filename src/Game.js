/**
 * Main Game File - Into The Deluge
 * Top-down dungeon crawler with custom engine
 */

import { Engine, Scene } from './engine/core/Engine.js';
import { Entity, SpriteComponent, AnimationComponent, HealthComponent, ColliderComponent } from './engine/core/Entity.js';
import { Vector2, randomFloat, randomInt, clamp } from './engine/core/Utils.js';
import { Character } from './classes/Character.js';
import { ClassDefinitions } from './classes/ClassDefinitions.js';
import { SkillTree, SkillTreeDefinitions } from './classes/SkillTree.js';
import { WeaponTypes, WeaponRarities, generateWeaponDrop } from './combat/Weapon.js';
import { CombatManager } from './combat/Combat.js';
import { Enemy, EnemyTypes, BossTypes, generateEnemyDrop } from './combat/Enemy.js';
import { DungeonGenerator, DungeonRenderer, TILE_TYPES } from './dungeon/DungeonGenerator.js';
import { UIManager, HUD, SkillTreePanel, InventoryPanel, ClassSelectionUI } from './ui/UI.js';

// Game states
const GameState = {
    LOADING: 'loading',
    CLASS_SELECT: 'classSelect',
    PLAYING: 'playing',
    PAUSED: 'paused',
    DEAD: 'dead',
    VICTORY: 'victory'
};

// Player Controller - handles input and controls the character
class PlayerController {
    constructor(character, engine) {
        this.character = character;
        this.engine = engine;
        this.moveDirection = { x: 0, y: 0 };
        this.aimDirection = { x: 1, y: 0 };
        this.lastMouse = { x: 0, y: 0 };
    }
    
    update(dt, camera) {
        // Movement input
        this.moveDirection = { x: 0, y: 0 };
        
        if (this.engine.isKeyPressed('KeyW') || this.engine.isKeyPressed('ArrowUp')) {
            this.moveDirection.y = -1;
        }
        if (this.engine.isKeyPressed('KeyS') || this.engine.isKeyPressed('ArrowDown')) {
            this.moveDirection.y = 1;
        }
        if (this.engine.isKeyPressed('KeyA') || this.engine.isKeyPressed('ArrowLeft')) {
            this.moveDirection.x = -1;
        }
        if (this.engine.isKeyPressed('KeyD') || this.engine.isKeyPressed('ArrowRight')) {
            this.moveDirection.x = 1;
        }
        
        // Normalize diagonal movement
        const len = Math.sqrt(this.moveDirection.x ** 2 + this.moveDirection.y ** 2);
        if (len > 0) {
            this.moveDirection.x /= len;
            this.moveDirection.y /= len;
        }
        
        // Calculate aim direction from mouse
        const mouse = this.engine.getMousePosition();
        const worldMouse = camera.screenToWorld(mouse.x, mouse.y);
        
        const dx = worldMouse.x - this.character.x;
        const dy = worldMouse.y - this.character.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            this.aimDirection = { x: dx / dist, y: dy / dist };
        }
        
        // Sprint (hold Shift)
        const isSprinting = this.engine.isKeyPressed('ShiftLeft') || this.engine.isKeyPressed('ShiftRight');
        
        // Dash (Space)
        if (this.engine.isKeyPressed('Space')) {
            this.character.dash(this.moveDirection.x, this.moveDirection.y);
        }
        
        // Movement
        this.character.move(this.moveDirection.x, this.moveDirection.y, dt, isSprinting);
        
        // Set facing direction
        this.character.facingX = this.aimDirection.x;
        this.character.facingY = this.aimDirection.y;
        
        // Ability keys (1-8)
        for (let i = 0; i < 8; i++) {
            if (this.engine.isKeyPressed(`Digit${i + 1}`)) {
                this.character.useAbility(i, worldMouse.x, worldMouse.y);
            }
        }
        
        // Basic attack (left mouse)
        if (this.engine.isMousePressed(0)) {
            this.character.attack(worldMouse.x, worldMouse.y);
        }
    }
}

// Main Game Scene
class GameScene extends Scene {
    constructor(engine, selectedClass) {
        super();
        this.engine = engine;
        this.selectedClass = selectedClass;
        
        // Initialize systems
        this.combatManager = new CombatManager();
        this.uiManager = new UIManager(engine.ctx, engine.canvas);
        this.hud = new HUD(engine.canvas);
        
        // Create player
        this.player = this.createPlayer(selectedClass);
        this.hud.setPlayer(this.player);
        this.controller = new PlayerController(this.player, engine);
        
        // Skill tree panel
        this.skillTreePanel = new SkillTreePanel(
            engine.canvas, 
            this.player.skillTree, 
            this.player
        );
        
        // Inventory panel
        this.inventoryPanel = new InventoryPanel(engine.canvas, this.player);
        
        // Dungeon
        this.dungeonGenerator = new DungeonGenerator();
        this.dungeonRenderer = new DungeonRenderer();
        this.dungeon = null;
        this.currentFloor = 1;
        
        // Entities
        this.enemies = [];
        this.items = [];
        this.projectiles = [];
        
        // Interaction
        this.interactionPrompt = null;
        
        // Camera
        this.camera = engine.camera;
        
        // Generate first dungeon
        this.generateDungeon();
    }
    
    createPlayer(className) {
        const classData = ClassDefinitions[className];
        
        // Create SkillTree instance instead of using raw definitions
        const skillTree = new SkillTree(classData);
        
        const player = new Character(classData, skillTree);
        player.width = 32;
        player.height = 32;
        
        // Give starting weapon based on class
        const weaponType = classData.weaponTypes[0];
        const startingWeapon = generateWeaponDrop(1, weaponType);
        player.equipItem('weapon', startingWeapon);
        
        return player;
    }
    
    generateDungeon() {
        // Increase difficulty with floor
        const config = {
            width: 80 + this.currentFloor * 10,
            height: 80 + this.currentFloor * 10,
            roomCount: 8 + this.currentFloor * 2,
            minRoomSize: 8,
            maxRoomSize: 16 + this.currentFloor,
            corridorWidth: 3,
            enemyDensity: 0.02 + this.currentFloor * 0.005,
            itemDensity: 0.01,
            trapDensity: 0.005 * this.currentFloor
        };
        
        this.dungeon = this.dungeonGenerator.generate(config);
        
        // Find spawn point and place player
        const spawn = this.dungeon.spawnPoints.find(s => s.type === 'player');
        if (spawn) {
            this.player.x = spawn.x * 32 + 16;
            this.player.y = spawn.y * 32 + 16;
        } else if (this.dungeon.startRoom) {
            // Fallback to start room center
            this.player.x = this.dungeon.startRoom.centerX * 32 + 16;
            this.player.y = this.dungeon.startRoom.centerY * 32 + 16;
        }
        
        // Validate player is on a floor tile, if not find nearest floor
        const playerTileX = Math.floor(this.player.x / 32);
        const playerTileY = Math.floor(this.player.y / 32);
        if (this.dungeon.getTile(playerTileX, playerTileY) !== TILE_TYPES.FLOOR &&
            this.dungeon.getTile(playerTileX, playerTileY) !== TILE_TYPES.STAIRS_UP) {
            // Search nearby for a valid floor tile
            for (let radius = 1; radius < 10; radius++) {
                let found = false;
                for (let dy = -radius; dy <= radius && !found; dy++) {
                    for (let dx = -radius; dx <= radius && !found; dx++) {
                        const checkX = playerTileX + dx;
                        const checkY = playerTileY + dy;
                        const tile = this.dungeon.getTile(checkX, checkY);
                        if (tile === TILE_TYPES.FLOOR || tile === TILE_TYPES.STAIRS_UP) {
                            this.player.x = checkX * 32 + 16;
                            this.player.y = checkY * 32 + 16;
                            found = true;
                        }
                    }
                }
                if (found) break;
            }
        }
        
        // Store previous position for collision
        this.player.prevX = this.player.x;
        this.player.prevY = this.player.y;
        
        // Center camera on player
        this.camera.centerOn(this.player.x, this.player.y);
        
        // Spawn enemies
        this.spawnEnemies();
        
        // Notification
        this.uiManager.addNotification(`Floor ${this.currentFloor}`, 'info');
        
        // Boss on every 5th floor
        if (this.currentFloor % 5 === 0) {
            this.spawnBoss();
            this.uiManager.addNotification('A powerful enemy awaits...', 'warning');
        }
    }
    
    spawnEnemies() {
        this.enemies = [];
        
        // Get enemy spawn points
        const enemySpawns = this.dungeon.spawnPoints.filter(s => s.type === 'enemy');
        
        // Select enemy types based on floor
        const availableTypes = Object.keys(EnemyTypes).filter(type => {
            const enemyData = EnemyTypes[type];
            return this.currentFloor >= (enemyData.minFloor || 1);
        });
        
        for (const spawn of enemySpawns) {
            const type = availableTypes[randomInt(0, availableTypes.length - 1)];
            const enemyData = EnemyTypes[type];
            
            const enemy = new Enemy(type, enemyData, this.currentFloor);
            enemy.x = spawn.x * 32 + 16;
            enemy.y = spawn.y * 32 + 16;
            
            this.enemies.push(enemy);
        }
    }
    
    spawnBoss() {
        // Find the largest room that isn't the spawn room
        const bossRoom = this.dungeon.rooms
            .filter(r => !this.dungeon.spawnPoints.some(s => s.type === 'player' && r.contains(s.x, s.y)))
            .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
        
        if (bossRoom) {
            const bossTypes = Object.keys(BossTypes);
            const bossType = bossTypes[this.currentFloor % bossTypes.length];
            const bossData = BossTypes[bossType];
            
            const boss = new Enemy(bossType, bossData, this.currentFloor, true);
            boss.x = (bossRoom.x + bossRoom.width / 2) * 32;
            boss.y = (bossRoom.y + bossRoom.height / 2) * 32;
            
            this.enemies.push(boss);
        }
    }
    
    openChest(tileX, tileY) {
        // Generate loot
        const roll = Math.random();
        
        if (roll < 0.3) {
            // Gold
            const goldAmount = randomInt(20 + this.currentFloor * 10, 50 + this.currentFloor * 25);
            this.player.gold = (this.player.gold || 0) + goldAmount;
            this.uiManager.addNotification(`Found ${goldAmount} gold!`, 'gold');
        } else if (roll < 0.7) {
            // Weapon
            const weapon = generateWeaponDrop(this.currentFloor, this.player.stats.luck);
            this.items.push({
                x: tileX * 32 + 16,
                y: tileY * 32 + 16,
                item: weapon
            });
            this.uiManager.addNotification(`Found ${weapon.name}!`, 'item');
        } else if (roll < 0.85) {
            // Health potion
            const healAmount = Math.floor(this.player.maxHealth * 0.3);
            this.player.health = Math.min(this.player.maxHealth, this.player.health + healAmount);
            this.uiManager.addNotification(`Found health potion! +${healAmount} HP`, 'heal');
            this.uiManager.addDamageNumber(this.player.x, this.player.y - 20, healAmount, false, true);
        } else {
            // Mana potion
            const manaAmount = Math.floor(this.player.maxMana * 0.5);
            this.player.mana = Math.min(this.player.maxMana, this.player.mana + manaAmount);
            this.uiManager.addNotification(`Found mana potion! +${manaAmount} MP`, 'mana');
        }
        
        // Convert chest to floor
        this.dungeon.tiles[tileY][tileX] = TILE_TYPES.FLOOR;
        this.dungeonRenderer.updateTile(tileX, tileY, TILE_TYPES.FLOOR);
        
        // Effects
        this.camera.shake(2, 0.1);
    }
    
    update(dt) {
        // Handle UI toggles
        if (this.engine.wasKeyJustPressed('KeyK')) {
            this.skillTreePanel.toggle();
        }
        if (this.engine.wasKeyJustPressed('KeyI')) {
            this.inventoryPanel.toggle();
        }
        if (this.engine.wasKeyJustPressed('Escape')) {
            this.skillTreePanel.hide();
            this.inventoryPanel.hide();
        }
        
        // If a panel is open, handle its input
        if (this.skillTreePanel.visible) {
            const mouse = this.engine.getMousePosition();
            this.skillTreePanel.handleHover(mouse.x, mouse.y);
            
            if (this.engine.wasMouseJustPressed(0)) {
                this.skillTreePanel.handleClick(mouse.x, mouse.y);
            }
            return;
        }
        
        if (this.inventoryPanel.visible) {
            return;
        }
        
        // Update player controller
        this.controller.update(dt, this.camera);
        
        // Handle pending dash with wall collision checking
        if (this.player.pendingDash) {
            const dash = this.player.pendingDash;
            this.player.pendingDash = null;
            
            // Check dash path step by step for walls
            const steps = 12;
            const stepDistance = dash.distance / steps;
            let lastValidX = dash.startX;
            let lastValidY = dash.startY;
            
            for (let i = 1; i <= steps; i++) {
                const testX = dash.startX + dash.dirX * stepDistance * i;
                const testY = dash.startY + dash.dirY * stepDistance * i;
                
                // Check if this position collides with walls
                if (this.isPositionBlocked(testX, testY, this.player.width, this.player.height)) {
                    // Stop at last valid position
                    break;
                }
                
                lastValidX = testX;
                lastValidY = testY;
            }
            
            // Set player to last valid position
            this.player.x = lastValidX;
            this.player.y = lastValidY;
        }
        
        // Update player
        this.player.update(dt);
        
        // Check for status effect visuals on player
        if (this.player.pendingStatusVisual) {
            this.combatManager.addStatusVisual(this.player, this.player.pendingStatusVisual);
            this.player.pendingStatusVisual = null;
        }
        
        // Handle player attacks
        if (this.player.pendingAttack) {
            const attack = this.player.pendingAttack;
            this.combatManager.addAttack(attack, this.player);
            this.player.pendingAttack = null;
        }
        
        // Collision with dungeon walls
        this.handleWallCollision(this.player);
        
        // Update enemies
        for (const enemy of this.enemies) {
            enemy.update(dt, this.player, this.dungeon);
            
            // Check for status effect visuals on enemy
            if (enemy.pendingStatusVisual) {
                this.combatManager.addStatusVisual(enemy, enemy.pendingStatusVisual);
                enemy.pendingStatusVisual = null;
            }
            
            // Enemy attacks
            if (enemy.pendingAttack) {
                this.combatManager.addAttack(enemy.pendingAttack, enemy);
                enemy.pendingAttack = null;
            }
            
            this.handleWallCollision(enemy);
        }
        
        // Update combat
        const combatResults = this.combatManager.update(dt, [...this.enemies, this.player]);
        
        // Process combat results
        for (const result of combatResults) {
            if (result.damage > 0) {
                this.uiManager.addDamageNumber(
                    result.target.x,
                    result.target.y - 20,
                    result.damage,
                    result.isCrit
                );
                
                // Screen shake on big hits
                if (result.damage > 50) {
                    this.camera.shake(5, 0.1);
                }
            }
        }
        
        // Check for dead enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.health <= 0) {
                // Award experience
                this.player.gainExperience(enemy.expReward);
                
                // Drop loot
                if (Math.random() < enemy.dropChance) {
                    const weapon = generateEnemyDrop(enemy, this.currentFloor);
                    if (weapon) {
                        this.items.push({
                            x: enemy.x,
                            y: enemy.y,
                            item: weapon
                        });
                    }
                }
                
                // Drop gold
                const goldAmount = randomInt(enemy.level * 5, enemy.level * 15);
                this.player.gold = (this.player.gold || 0) + goldAmount;
                
                // Boss kill notification
                if (enemy.isBoss) {
                    this.uiManager.addNotification(`${enemy.name} defeated!`, 'success');
                    this.camera.shake(15, 0.3);
                }
                
                this.enemies.splice(i, 1);
            }
        }
        
        // Check for player level up
        if (this.player.justLeveledUp) {
            this.uiManager.addNotification(`Level Up! Now level ${this.player.level}`, 'levelup');
            this.player.justLeveledUp = false;
            this.camera.shake(3, 0.2);
        }
        
        // Check if player can multiclass
        if (this.player.level === 25 && !this.player.multiclassNotified) {
            this.uiManager.addNotification('Multiclassing is now available!', 'success');
            this.player.multiclassNotified = true;
        }
        
        // Item pickup
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            const dist = Math.sqrt((this.player.x - item.x) ** 2 + (this.player.y - item.y) ** 2);
            
            if (dist < 40) {
                // Auto-pickup
                if (this.player.addToInventory(item.item)) {
                    this.uiManager.addNotification(`Picked up ${item.item.name}`, 'info');
                    this.items.splice(i, 1);
                }
            }
        }
        
        // Check for stairs
        const playerTileX = Math.floor(this.player.x / 32);
        const playerTileY = Math.floor(this.player.y / 32);
        const currentTile = this.dungeon.getTile(playerTileX, playerTileY);
        
        // Interaction prompt
        this.interactionPrompt = null;
        
        if (currentTile === TILE_TYPES.STAIRS_DOWN) {
            this.interactionPrompt = 'Press E to descend';
            if (this.engine.wasKeyJustPressed('KeyE')) {
                this.currentFloor++;
                this.generateDungeon();
            }
        } else if (currentTile === TILE_TYPES.STAIRS_UP && this.currentFloor > 1) {
            this.interactionPrompt = 'Press E to ascend';
            if (this.engine.wasKeyJustPressed('KeyE')) {
                this.currentFloor--;
                this.generateDungeon();
            }
        } else if (currentTile === TILE_TYPES.CHEST) {
            this.interactionPrompt = 'Press E to open chest';
            if (this.engine.wasKeyJustPressed('KeyE')) {
                this.openChest(playerTileX, playerTileY);
            }
        } else if (currentTile === TILE_TYPES.TRAP) {
            // Trigger trap damage
            if (!this.player.invulnerable) {
                const trapDamage = 10 + this.currentFloor * 5;
                this.player.takeDamage(trapDamage);
                this.uiManager.addDamageNumber(this.player.x, this.player.y - 20, trapDamage, false);
                this.uiManager.addNotification('Stepped on a trap!', 'warning');
                this.camera.shake(5, 0.15);
                // Convert trap to floor after triggering
                this.dungeon.tiles[playerTileY][playerTileX] = TILE_TYPES.FLOOR;
                this.dungeonRenderer.updateTile(playerTileX, playerTileY, TILE_TYPES.FLOOR);
            }
        } else if (currentTile === TILE_TYPES.WATER) {
            // Slow movement in water
            this.player.maxSpeed = this.player.baseSpeed * 0.6;
        } else if (currentTile === TILE_TYPES.LAVA) {
            // Lava damage over time
            if (!this.player.invulnerable) {
                const lavaDamage = Math.floor(5 + this.currentFloor * 2);
                this.player.takeDamage(lavaDamage);
            }
        } else {
            // Reset speed when on normal ground
            this.player.maxSpeed = this.player.baseSpeed;
        }
        
        // Update UI
        this.uiManager.update(dt);
        
        // Camera follow player smoothly
        this.camera.smoothFollow(this.player.x, this.player.y, 5, dt);
        this.camera.update(dt);
        
        // Check player death
        if (this.player.health <= 0) {
            return GameState.DEAD;
        }
        
        return GameState.PLAYING;
    }
    
    handleWallCollision(entity) {
        const halfW = entity.width / 2;
        const halfH = entity.height / 2;
        const tileSize = 32;
        
        // Store old position to revert if needed
        const oldX = entity.prevX !== undefined ? entity.prevX : entity.x;
        const oldY = entity.prevY !== undefined ? entity.prevY : entity.y;
        
        // Check all corners for wall collision
        const checkPoints = [
            { x: entity.x - halfW + 2, y: entity.y - halfH + 2 },  // top-left
            { x: entity.x + halfW - 2, y: entity.y - halfH + 2 },  // top-right
            { x: entity.x - halfW + 2, y: entity.y + halfH - 2 },  // bottom-left
            { x: entity.x + halfW - 2, y: entity.y + halfH - 2 }   // bottom-right
        ];
        
        let collidedX = false;
        let collidedY = false;
        
        // Check horizontal movement
        for (const point of checkPoints) {
            const tileX = Math.floor(point.x / tileSize);
            const tileY = Math.floor(oldY / tileSize + (point.y - entity.y) / tileSize);
            const tile = this.dungeon.getTile(tileX, tileY);
            
            if (tile === TILE_TYPES.WALL || tile === TILE_TYPES.EMPTY) {
                collidedX = true;
                break;
            }
        }
        
        // Check vertical movement
        for (const point of checkPoints) {
            const tileX = Math.floor(oldX / tileSize + (point.x - entity.x) / tileSize);
            const tileY = Math.floor(point.y / tileSize);
            const tile = this.dungeon.getTile(tileX, tileY);
            
            if (tile === TILE_TYPES.WALL || tile === TILE_TYPES.EMPTY) {
                collidedY = true;
                break;
            }
        }
        
        // Revert position on collision axis
        if (collidedX) {
            entity.x = oldX;
        }
        if (collidedY) {
            entity.y = oldY;
        }
        
        // Final safety check - if still in wall, push out
        for (const point of checkPoints) {
            const tileX = Math.floor(point.x / tileSize);
            const tileY = Math.floor(point.y / tileSize);
            const tile = this.dungeon.getTile(tileX, tileY);
            
            if (tile === TILE_TYPES.WALL || tile === TILE_TYPES.EMPTY) {
                // Find nearest valid floor tile
                entity.x = oldX;
                entity.y = oldY;
                break;
            }
        }
    }
    
    // Check if a position is blocked by walls
    isPositionBlocked(x, y, width, height) {
        const halfW = width / 2;
        const halfH = height / 2;
        const tileSize = 32;
        
        // Check corners
        const checkPoints = [
            { x: x - halfW + 2, y: y - halfH + 2 },
            { x: x + halfW - 2, y: y - halfH + 2 },
            { x: x - halfW + 2, y: y + halfH - 2 },
            { x: x + halfW - 2, y: y + halfH - 2 }
        ];
        
        for (const point of checkPoints) {
            const tileX = Math.floor(point.x / tileSize);
            const tileY = Math.floor(point.y / tileSize);
            const tile = this.dungeon.getTile(tileX, tileY);
            
            if (tile === TILE_TYPES.WALL || tile === TILE_TYPES.EMPTY) {
                return true;
            }
        }
        
        return false;
    }
    
    render(ctx) {
        // Clear with dark background
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Apply camera transform
        ctx.save();
        ctx.translate(
            -this.camera.x + ctx.canvas.width / 2,
            -this.camera.y + ctx.canvas.height / 2
        );
        
        // Render dungeon
        this.dungeonRenderer.render(ctx, this.dungeon, this.camera);
        
        // Render items with floating animation
        const time = Date.now() / 1000;
        for (const item of this.items) {
            const floatY = Math.sin(time * 3 + item.x) * 4;
            const pulse = 0.8 + Math.sin(time * 4 + item.y) * 0.2;
            
            // Glow effect
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = item.item.color || '#ffff00';
            ctx.beginPath();
            ctx.arc(item.x, item.y + floatY, 15 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Item body
            ctx.fillStyle = item.item.color || '#ffff00';
            ctx.fillRect(item.x - 8, item.y - 8 + floatY, 16, 16);
            
            // Item shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillRect(item.x - 6, item.y - 6 + floatY, 4, 4);
            
            // Item border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(item.x - 8, item.y - 8 + floatY, 16, 16);
        }
        
        // Render enemies
        for (const enemy of this.enemies) {
            this.renderEnemy(ctx, enemy);
        }
        
        // Render player
        this.renderPlayer(ctx);
        
        // Render combat effects
        this.combatManager.render(ctx);
        
        // Render world UI (damage numbers)
        this.uiManager.renderWorldUI(ctx, this.camera);
        
        ctx.restore();
        
        // Render screen-space UI
        this.hud.render(ctx);
        this.uiManager.renderScreenUI(ctx);
        
        // Render panels
        this.skillTreePanel.render(ctx);
        this.inventoryPanel.render(ctx);
        
        // Floor indicator
        ctx.fillStyle = '#888';
        ctx.font = '14px Arial';
        ctx.fillText(`Floor ${this.currentFloor}`, 10, ctx.canvas.height - 10);
        
        // Interaction prompt
        if (this.interactionPrompt) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(ctx.canvas.width / 2 - 100, ctx.canvas.height - 80, 200, 30);
            ctx.fillStyle = '#ffff88';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.interactionPrompt, ctx.canvas.width / 2, ctx.canvas.height - 60);
            ctx.textAlign = 'left';
        }
        
        // Controls hint
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText('WASD: Move | Mouse: Aim | Click: Attack | E: Interact | K: Skills | I: Inventory', 
            ctx.canvas.width / 2 - 260, ctx.canvas.height - 10);
    }
    
    renderPlayer(ctx) {
        const p = this.player;
        const time = Date.now() / 1000;
        
        // Calculate animation values
        const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);
        const isMoving = speed > 10;
        const bobOffset = isMoving ? Math.sin(time * 12) * 3 : Math.sin(time * 2) * 1;
        const squashStretch = isMoving ? 1 + Math.sin(time * 12) * 0.1 : 1;
        
        // Render dash trail (ghost images)
        if (p.dashTrail && p.dashTrail.length > 0) {
            const classData = ClassDefinitions[this.selectedClass];
            const baseColor = classData.color || '#4488ff';
            
            for (const trail of p.dashTrail) {
                ctx.save();
                ctx.globalAlpha = trail.alpha * 0.5;
                
                // Ghost body
                ctx.fillStyle = baseColor;
                ctx.fillRect(trail.x - p.width/2, trail.y - p.height/2, p.width, p.height);
                
                // Dash effect glow
                ctx.shadowColor = '#88ccff';
                ctx.shadowBlur = 15;
                ctx.strokeStyle = '#88ccff';
                ctx.lineWidth = 2;
                ctx.strokeRect(trail.x - p.width/2, trail.y - p.height/2, p.width, p.height);
                
                ctx.restore();
            }
        }
        
        // Dash active effect
        if (p.isDashing) {
            // Motion blur effect
            ctx.save();
            ctx.globalAlpha = 0.3;
            const blurDist = 20;
            for (let i = 1; i <= 3; i++) {
                ctx.globalAlpha = 0.3 - i * 0.08;
                const bx = p.x - p.dashDirX * blurDist * i;
                const by = p.y - p.dashDirY * blurDist * i;
                ctx.fillStyle = '#88ccff';
                ctx.fillRect(bx - p.width/2, by - p.height/2, p.width, p.height);
            }
            ctx.restore();
        }
        
        // Shadow (animated with movement)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        const shadowScale = isMoving ? 0.9 + Math.sin(time * 12) * 0.1 : 1;
        ctx.ellipse(p.x, p.y + p.height/2 + 2, p.width/2 * shadowScale, p.height/4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.save();
        ctx.translate(p.x, p.y + bobOffset);
        
        // Body with squash/stretch
        const classData = ClassDefinitions[this.selectedClass];
        const baseColor = classData.color || '#4488ff';
        
        // Draw body (animated)
        ctx.fillStyle = baseColor;
        const bodyW = p.width * (2 - squashStretch);
        const bodyH = p.height * squashStretch;
        ctx.fillRect(-bodyW/2, -bodyH/2, bodyW, bodyH);
        
        // Inner body detail
        ctx.fillStyle = this.lightenColor(baseColor, 20);
        ctx.fillRect(-bodyW/2 + 4, -bodyH/2 + 4, bodyW - 8, bodyH/2 - 4);
        
        // Eyes (follow mouse direction)
        const eyeOffsetX = p.facingX * 3;
        const eyeOffsetY = p.facingY * 2;
        ctx.fillStyle = '#fff';
        ctx.fillRect(-6 + eyeOffsetX, -4 + eyeOffsetY, 5, 5);
        ctx.fillRect(1 + eyeOffsetX, -4 + eyeOffsetY, 5, 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(-5 + eyeOffsetX + p.facingX * 2, -3 + eyeOffsetY, 3, 3);
        ctx.fillRect(2 + eyeOffsetX + p.facingX * 2, -3 + eyeOffsetY, 3, 3);
        
        // Weapon indicator based on attack cooldown
        if (p.attackCooldown > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            const swingAngle = (p.attackCooldown / 0.5) * Math.PI;
            ctx.save();
            ctx.rotate(Math.atan2(p.facingY, p.facingX) - swingAngle);
            ctx.fillRect(10, -2, 15, 4);
            ctx.restore();
        }
        
        ctx.restore();
        
        // Direction indicator (small arrow)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        const arrowDist = 20;
        const arrowX = p.x + p.facingX * arrowDist;
        const arrowY = p.y + p.facingY * arrowDist + bobOffset;
        ctx.moveTo(arrowX + p.facingX * 6, arrowY + p.facingY * 6);
        ctx.lineTo(arrowX - p.facingY * 4, arrowY + p.facingX * 4);
        ctx.lineTo(arrowX + p.facingY * 4, arrowY - p.facingX * 4);
        ctx.closePath();
        ctx.fill();
        
        // Health bar above player
        const healthPercent = p.health / p.maxHealth;
        ctx.fillStyle = '#222';
        ctx.fillRect(p.x - 22, p.y - p.height/2 - 12 + bobOffset, 44, 8);
        const healthColor = healthPercent > 0.6 ? '#44ff44' : healthPercent > 0.3 ? '#ffaa00' : '#ff4444';
        ctx.fillStyle = healthColor;
        ctx.fillRect(p.x - 20, p.y - p.height/2 - 10 + bobOffset, 40 * healthPercent, 4);
        
        // Mana bar
        const manaPercent = p.mana / p.maxMana;
        ctx.fillStyle = '#4466ff';
        ctx.fillRect(p.x - 20, p.y - p.height/2 - 5 + bobOffset, 40 * manaPercent, 3);
        
        // Status effect indicators with pulse
        let effectIndex = 0;
        for (const [name, effect] of p.statusEffects) {
            const pulse = 0.7 + Math.sin(time * 4 + effectIndex) * 0.3;
            ctx.globalAlpha = pulse;
            ctx.fillStyle = effect.color || '#ffaa00';
            ctx.fillRect(p.x - 20 + effectIndex * 8, p.y - p.height/2 - 20 + bobOffset, 6, 6);
            effectIndex++;
        }
        ctx.globalAlpha = 1;
        
        // Sprint indicator
        if (p.isSprinting) {
            ctx.strokeStyle = 'rgba(255, 255, 100, 0.5)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const trailX = p.x - p.velocity.x * 0.02 * (i + 1);
                const trailY = p.y - p.velocity.y * 0.02 * (i + 1);
                ctx.globalAlpha = 0.3 - i * 0.1;
                ctx.strokeRect(trailX - p.width/2, trailY - p.height/2 + bobOffset, p.width, p.height);
            }
            ctx.globalAlpha = 1;
        }
    }
    
    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
    
    renderEnemy(ctx, enemy) {
        const time = Date.now() / 1000;
        const speed = Math.sqrt(enemy.velocity.x ** 2 + enemy.velocity.y ** 2);
        const isMoving = speed > 5;
        const bobOffset = isMoving ? Math.sin(time * 10 + enemy.x) * 2 : Math.sin(time * 2 + enemy.x) * 1;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(enemy.x, enemy.y + enemy.height/2 + 2, enemy.width/2, enemy.height/4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.save();
        ctx.translate(enemy.x, enemy.y + bobOffset);
        
        // Body
        if (enemy.isBoss) {
            // Boss glow effect
            ctx.shadowColor = enemy.color;
            ctx.shadowBlur = 15 + Math.sin(time * 3) * 5;
        }
        
        ctx.fillStyle = enemy.color;
        const squash = isMoving ? 1 + Math.sin(time * 10) * 0.05 : 1;
        ctx.fillRect(-enemy.width/2 * (2 - squash), -enemy.height/2 * squash, 
                     enemy.width * (2 - squash), enemy.height * squash);
        
        ctx.shadowBlur = 0;
        
        // Face features based on state
        if (enemy.state === 'attack') {
            // Angry eyes
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-8, -6, 6, 6);
            ctx.fillRect(2, -6, 6, 6);
            // Open mouth
            ctx.fillStyle = '#400000';
            ctx.fillRect(-4, 4, 8, 4);
        } else if (enemy.state === 'chase') {
            // Alert eyes
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(-6, -4, 5, 5);
            ctx.fillRect(1, -4, 5, 5);
            ctx.fillStyle = '#000';
            const lookX = enemy.facing?.x || 0;
            ctx.fillRect(-5 + lookX * 2, -3, 3, 3);
            ctx.fillRect(2 + lookX * 2, -3, 3, 3);
        } else {
            // Idle eyes
            ctx.fillStyle = '#ff6666';
            ctx.fillRect(-6, -4, 4, 4);
            ctx.fillRect(2, -4, 4, 4);
        }
        
        ctx.restore();
        
        // Health bar
        const healthPercent = enemy.health / enemy.maxHealth;
        const barWidth = enemy.isBoss ? 60 : 30;
        ctx.fillStyle = '#222';
        ctx.fillRect(enemy.x - barWidth/2 - 1, enemy.y - enemy.height/2 - 10 + bobOffset, barWidth + 2, 6);
        
        const healthColor = enemy.isBoss ? '#ff00ff' : 
                           healthPercent > 0.5 ? '#ff4444' : 
                           healthPercent > 0.25 ? '#ff8800' : '#ff0000';
        ctx.fillStyle = healthColor;
        ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.height/2 - 9 + bobOffset, barWidth * healthPercent, 4);
        
        // Boss name with shadow
        if (enemy.isBoss) {
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000';
            ctx.fillText(enemy.name, enemy.x + 1, enemy.y - enemy.height/2 - 14 + bobOffset);
            ctx.fillStyle = '#ff88ff';
            ctx.fillText(enemy.name, enemy.x, enemy.y - enemy.height/2 - 15 + bobOffset);
            ctx.textAlign = 'left';
        }
        
        // Damage flash effect
        if (enemy.invulnerabilityTime > 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#fff';
            ctx.fillRect(enemy.x - enemy.width/2, enemy.y - enemy.height/2 + bobOffset, enemy.width, enemy.height);
            ctx.globalAlpha = 1;
        }
    }
}

// Death Screen Scene
class DeathScene extends Scene {
    constructor(engine, floor, level) {
        super();
        this.engine = engine;
        this.floor = floor;
        this.level = level;
    }
    
    update(dt) {
        if (this.engine.wasKeyJustPressed('Space')) {
            return 'restart';
        }
        return GameState.DEAD;
    }
    
    render(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('YOU DIED', ctx.canvas.width / 2, ctx.canvas.height / 2 - 50);
        
        ctx.fillStyle = '#aaa';
        ctx.font = '24px Arial';
        ctx.fillText(`Reached Floor ${this.floor} at Level ${this.level}`, ctx.canvas.width / 2, ctx.canvas.height / 2 + 20);
        
        ctx.fillStyle = '#fff';
        ctx.font = '18px Arial';
        ctx.fillText('Press SPACE to try again', ctx.canvas.width / 2, ctx.canvas.height / 2 + 80);
        
        ctx.textAlign = 'left';
    }
}

// Main Game Class
class IntoTheDeluge {
    constructor() {
        this.engine = null;
        this.state = GameState.LOADING;
        this.classSelectUI = null;
        this.currentScene = null;
        this.selectedClass = null;
    }
    
    async init() {
        // Create and initialize engine
        this.engine = new Engine('gameCanvas');
        
        // Set up class selection
        this.classSelectUI = new ClassSelectionUI(
            this.engine.canvas,
            ClassDefinitions,
            (className) => this.onClassSelected(className)
        );
        
        // Set up input handlers for class selection
        this.engine.canvas.addEventListener('click', (e) => {
            const rect = this.engine.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.state === GameState.CLASS_SELECT) {
                this.classSelectUI.handleClick(x, y);
            }
        });
        
        this.engine.canvas.addEventListener('mousemove', (e) => {
            const rect = this.engine.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.state === GameState.CLASS_SELECT) {
                this.classSelectUI.handleHover(x, y);
            }
        });
        
        this.state = GameState.CLASS_SELECT;
        
        // Start game loop
        this.engine.start((dt) => this.update(dt), (ctx) => this.render(ctx));
    }
    
    onClassSelected(className) {
        this.selectedClass = className;
        this.currentScene = new GameScene(this.engine, className);
        this.state = GameState.PLAYING;
    }
    
    update(dt) {
        switch (this.state) {
            case GameState.CLASS_SELECT:
                // Class selection is handled by click events
                break;
                
            case GameState.PLAYING:
                if (this.currentScene) {
                    const result = this.currentScene.update(dt);
                    if (result === GameState.DEAD) {
                        this.currentScene = new DeathScene(
                            this.engine,
                            this.currentScene.currentFloor,
                            this.currentScene.player.level
                        );
                        this.state = GameState.DEAD;
                    }
                }
                break;
                
            case GameState.DEAD:
                if (this.currentScene) {
                    const result = this.currentScene.update(dt);
                    if (result === 'restart') {
                        this.state = GameState.CLASS_SELECT;
                        this.currentScene = null;
                    }
                }
                break;
        }
    }
    
    render(ctx) {
        switch (this.state) {
            case GameState.CLASS_SELECT:
                this.classSelectUI.render(ctx);
                break;
                
            case GameState.PLAYING:
            case GameState.DEAD:
                if (this.currentScene) {
                    this.currentScene.render(ctx);
                }
                break;
                
            case GameState.LOADING:
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Loading...', ctx.canvas.width / 2, ctx.canvas.height / 2);
                break;
        }
    }
}

// Export game
export default IntoTheDeluge;

// Initialize game when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const game = new IntoTheDeluge();
        game.init();
    });
}
