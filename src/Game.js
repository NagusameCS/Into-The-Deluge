/**
 * Main Game File - Into The Deluge
 * Top-down dungeon crawler with custom engine
 */

import { Engine, Scene } from './engine/core/Engine.js';
import { Entity, SpriteComponent, AnimationComponent, HealthComponent, ColliderComponent } from './engine/core/Entity.js';
import { Vector2, randomFloat, randomInt, clamp } from './engine/core/Utils.js';
import { SoundManager, FLOOR_THEMES, FLOOR_ORDER } from './engine/core/SoundManager.js';
import { Character } from './classes/Character.js';
import { ClassDefinitions } from './classes/ClassDefinitions.js';
import { SkillTree, SkillTreeDefinitions } from './classes/SkillTree.js';
import { WeaponTypes, WeaponRarities, generateWeaponDrop, generateBossWeapon } from './combat/Weapon.js';
import { CombatManager } from './combat/Combat.js';
import { Enemy, EnemyTypes, BossTypes, FloorEnemies, generateEnemyDrop } from './combat/Enemy.js';
import { DungeonGenerator, DungeonRenderer, TILE_TYPES } from './dungeon/DungeonGenerator.js';
import { PuzzleFactory } from './dungeon/Puzzles.js';
import { PuzzleUI } from './ui/PuzzleUI.js';
import { UIManager, HUD, SkillTreePanel, InventoryPanel, ClassSelectionUI, PauseMenu } from './ui/UI.js';
import { MarketLayout, MarketBuilding, MarketNPC, Mercenary, FortuneReading, ArenaChallenge, GuildQuest, BUILDING_TYPES, NPC_TYPES } from './market/Market.js';
import MarketUI from './ui/MarketUI.js';

// Game states
const GameState = {
    LOADING: 'loading',
    CLASS_SELECT: 'classSelect',
    PLAYING: 'playing',
    PAUSED: 'paused',
    DEAD: 'dead',
    VICTORY: 'victory',
    MARKET: 'market'
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
        
        // Dash, Teleport, or Parry (Space)
        if (this.engine.wasKeyJustPressed('Space')) {
            // Mages teleport, dash classes dash, others parry
            if (this.character.canTeleport) {
                this.character.teleport(this.moveDirection.x, this.moveDirection.y);
            } else if (this.character.canDash) {
                this.character.dash(this.moveDirection.x, this.moveDirection.y);
            } else if (this.character.canParry) {
                // Parry for non-dash/non-teleport classes
                this.character.startParry();
            }
        }
        // Also allow holding Space for dash (for dash chaining)
        else if (this.engine.isKeyPressed('Space')) {
            if (this.character.canDash && !this.character.canTeleport) {
                this.character.dash(this.moveDirection.x, this.moveDirection.y);
            }
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
        
        // Level up screen state
        this.levelUpScreenActive = false;
        
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
        
        // Puzzle UI (for torch puzzles etc - kept for future use)
        this.puzzleUI = new PuzzleUI(engine.canvas);
        
        // Pause menu
        this.pauseMenu = new PauseMenu(engine.canvas, this);
        
        // Visual settings (controlled by pause menu)
        this.visualSettings = {
            screenShake: true,
            hitFreeze: true,
            screenFlash: true,
            particles: true
        };
        
        // Dungeon
        this.dungeonGenerator = new DungeonGenerator();
        this.dungeonRenderer = new DungeonRenderer();
        this.dungeon = null;
        this.currentFloor = 1;
        
        // Floor theme system
        this.currentFloorTheme = FLOOR_ORDER[0]; // Start with egypt
        this.floorThemeIndex = 0;
        
        // Sound manager
        this.soundManager = new SoundManager();
        this.footstepTimer = 0;
        this.footstepInterval = 0.5; // seconds between footsteps
        this.enemySoundTimer = 0;
        this.enemySoundInterval = 3; // seconds between random enemy sounds
        
        // Entities
        this.enemies = [];
        this.items = [];
        this.projectiles = [];
        
        // Interaction
        this.interactionPrompt = null;
        
        // Core system (torch system removed)
        this.corePosition = null;
        this.coreBossDefeated = false; // Track if core boss was killed
        this.dungeonCoreActivated = false; // Track if core has been activated (boss spawned)
        
        // Boss fight system
        this.inBossFight = false;
        this.bossRoom = null;
        this.bossRoomLocked = false;
        
        // Screen effects for cinematic combat
        this.screenEffects = {
            flashColor: null,
            flashAlpha: 0,
            flashDecay: 0,
            hitFreeze: 0,     // Brief pause on big hits
            bloomIntensity: 0,
            bloomDecay: 0
        };
        
        // Player afterimages for cinematic attacks
        this.playerAfterimages = [];
        this.afterimageTimer = 0;
        
        // Non-Euclidean wrap ghost system
        // Ghost appears at equivalent position on other side and mirrors movement
        this.wrapGhost = {
            active: false,
            timer: 0,
            delay: 0.15, // Time before player teleports to ghost
            x: 0,        // Ghost position (controlled by player input)
            y: 0,
            offsetX: 0,  // Offset from world edge (for X wrap)
            offsetY: 0,  // Offset from world edge (for Y wrap)
            wrapX: false, // Whether wrapping in X
            wrapY: false  // Whether wrapping in Y
        };
        
        // Fullscreen map toggle
        this.showFullscreenMap = false;
        
        // Quit to main menu flag (checked by Game class)
        this.quitToMenu = false;
        
        // Dev mode - invulnerability and other debug features
        this.devMode = false;
        
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
        // Determine floor theme based on current floor
        // Each floor gets a unique boss before cycling through again
        this.floorThemeIndex = (this.currentFloor - 1) % FLOOR_ORDER.length;
        this.currentFloorTheme = FLOOR_ORDER[this.floorThemeIndex];
        const theme = FLOOR_THEMES[this.currentFloorTheme];
        
        // Apply floor theme colors to renderer
        this.dungeonRenderer.setFloorTheme(theme.colors);
        
        // Reset core boss tracking for new floor
        this.coreBossDefeated = false;
        this.dungeonCoreActivated = false;
        
        // Increase difficulty with floor
        const config = {
            floor: this.currentFloor,
            width: 80 + this.currentFloor * 10,
            height: 80 + this.currentFloor * 10,
            roomCount: 8 + this.currentFloor * 2,
            minRoomSize: 6,
            maxRoomSize: Math.min(20, 10 + this.currentFloor), // Cap at 20x20
            corridorWidth: 3,
            enemyDensity: 0.02 + this.currentFloor * 0.005,
            itemDensity: 0.01,
            trapDensity: 0.005 * this.currentFloor
        };
        
        this.dungeon = this.dungeonGenerator.generate(config);
        
        // Update renderer with dungeon reference (needed for core rendering)
        this.dungeonRenderer.setDungeon(this.dungeon);
        
        // Update HUD with dungeon reference for minimap
        this.hud.setDungeon(this.dungeon);
        
        // Update CombatManager with dungeon reference for wall collision
        this.combatManager.setDungeon(this.dungeon);
        
        // Store core position from dungeon generation (torch system removed)
        this.corePosition = this.dungeon.corePosition || null;
        
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
        
        // Start ambient sound
        this.soundManager.startAmbient();
        
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
        
        // Debug: log spawn point count
        console.log(`Floor ${this.currentFloor} (${this.currentFloorTheme}): Found ${enemySpawns.length} enemy spawn points out of ${this.dungeon.spawnPoints.length} total spawn points`);
        
        // Get floor-themed enemies if available
        const floorData = FloorEnemies[this.currentFloorTheme];
        let availableTypes;
        let enemyPool;
        
        if (floorData && floorData.enemies) {
            // Use floor-themed enemies
            enemyPool = floorData.enemies;
            availableTypes = Object.keys(enemyPool);
            console.log(`Using floor theme enemies: ${availableTypes.join(', ')}`);
        } else {
            // Fallback to generic enemies
            console.log(`No floor data for theme "${this.currentFloorTheme}", using generic enemies`);
            enemyPool = EnemyTypes;
            availableTypes = Object.keys(EnemyTypes).filter(type => {
                const enemyData = EnemyTypes[type];
                return this.currentFloor >= (enemyData.minFloor || 1) && enemyData.type !== 'boss';
            });
        }
        
        // Safety check - need enemy types
        if (availableTypes.length === 0) {
            console.error('No enemy types available for spawning!');
            return;
        }
        
        for (const spawn of enemySpawns) {
            const type = availableTypes[randomInt(0, availableTypes.length - 1)];
            const enemyData = enemyPool[type];
            
            // Safety check - ensure enemy data exists
            if (!enemyData) {
                console.error(`No enemy data for type: ${type}`);
                continue;
            }
            
            const enemy = new Enemy(type, enemyData, this.currentFloor);
            enemy.x = spawn.x * 32 + 16;
            enemy.y = spawn.y * 32 + 16;
            
            // Store sound type for enemy sounds
            enemy.soundType = enemyData.soundType || 'smallMonsterAttack';
            
            this.enemies.push(enemy);
        }
        
        console.log(`Spawned ${this.enemies.length} enemies`);
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
    
    activateDungeonCore() {
        // Prevent re-activation if already activated
        if (this.dungeonCoreActivated) return;
        this.dungeonCoreActivated = true;
        
        // Spawn the floor boss at the core room
        this.uiManager.addNotification('The Dungeon Core awakens...', 'legendary');
        this.camera.shake(15, 1.0);
        
        // Play boss theme for this floor
        this.soundManager.playBossTheme(this.currentFloorTheme);
        
        // Find the core room
        const coreRoom = this.dungeon.coreRoom;
        
        if (coreRoom) {
            // Get floor-themed boss if available
            const floorData = FloorEnemies[this.currentFloorTheme];
            let bossType, bossData;
            
            if (floorData && floorData.boss) {
                const bossKeys = Object.keys(floorData.boss);
                bossType = bossKeys[0];
                bossData = floorData.boss[bossType];
            } else {
                // Fallback to generic bosses
                const bossTypes = Object.keys(BossTypes);
                bossType = bossTypes[this.currentFloor % bossTypes.length];
                bossData = BossTypes[bossType];
            }
            
            // Create a stronger boss for the core
            const boss = new Enemy(bossType, bossData, this.currentFloor + 2, true);
            boss.x = (coreRoom.x + coreRoom.width / 2) * 32;
            boss.y = (coreRoom.y + coreRoom.height / 2) * 32;
            
            // Make core boss even stronger
            boss.health *= 1.5;
            boss.maxHealth *= 1.5;
            boss.damage *= 1.25;
            
            // Mark this as the core boss for tracking
            boss.isCoreBoss = true;
            boss.soundType = bossData.soundType || 'largeMagic';
            
            this.enemies.push(boss);
            
            // NOTE: Keep the core tile as DUNGEON_CORE so player can interact to descend after boss defeat
            // We use dungeonCoreActivated flag to prevent re-spawning the boss
            
            this.uiManager.addNotification(`${bossData.name || bossType} has emerged!`, 'warning');
        }
    }
    
    advanceToNextFloor() {
        // Signal transition to market floor instead of directly generating new dungeon
        // The market floor will handle healing and then transition to next combat floor
        this.goToMarket = true;
        this.uiManager.addNotification('Entering the market...', 'legendary');
        this.camera.shake(10, 0.5);
    }
    
    // Called when returning from market to continue to next floor
    continueFromMarket() {
        this.currentFloor++;
        this.goToMarket = false;
        
        // Generate new dungeon (this will set new floor theme)
        this.generateDungeon();
        
        this.uiManager.addNotification(`Descended to floor ${this.currentFloor}!`, 'legendary');
    }
    
    openChest(tileX, tileY) {
        // Play chest sound
        this.soundManager.playChest();
        
        // Generate loot
        const roll = Math.random();
        
        if (roll < 0.3) {
            // Gold
            const goldAmount = randomInt(20 + this.currentFloor * 10, 50 + this.currentFloor * 25);
            this.player.gold = (this.player.gold || 0) + goldAmount;
            this.uiManager.addNotification(`Found ${goldAmount} gold!`, 'gold');
            this.soundManager.playCoin();
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
            this.soundManager.playHeal();
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
        // Update screen effects (may cause hit freeze)
        if (this.updateScreenEffects(dt)) {
            // In hit freeze - skip most updates but keep rendering
            return;
        }
        
        // Level up screen - freezes game world
        if (this.levelUpScreenActive) {
            this.updateLevelUpScreen();
            return; // Don't update anything else while allocating stats
        }
        
        // Handle UI toggles
        if (this.engine.wasKeyJustPressed('KeyK')) {
            this.skillTreePanel.toggle();
        }
        if (this.engine.wasKeyJustPressed('KeyI')) {
            this.inventoryPanel.toggle();
        }
        if (this.engine.wasKeyJustPressed('KeyM')) {
            this.showFullscreenMap = !this.showFullscreenMap;
        }
        // Spell cycling for mage classes (Q key or mouse wheel)
        if (this.engine.wasKeyJustPressed('KeyQ')) {
            const newSpell = this.player.cycleSpell?.();
            if (newSpell) {
                this.uiManager.addNotification(`Spell: ${newSpell.name}`, 'info');
            }
        }
        
        // Potion usage - R for health, F for mana
        if (this.engine.wasKeyJustPressed('KeyR')) {
            this.useHealthPotion();
        }
        if (this.engine.wasKeyJustPressed('KeyF')) {
            this.useManaPotion();
        }
        
        // Dev mode toggle - Backquote (`) key
        if (this.engine.wasKeyJustPressed('Backquote')) {
            this.devMode = !this.devMode;
            if (this.devMode) {
                this.player.invulnerable = true;
                this.uiManager.addNotification('DEV MODE: ON - Invulnerability enabled', 'legendary');
            } else {
                this.player.invulnerable = false;
                this.uiManager.addNotification('DEV MODE: OFF', 'info');
            }
        }
        
        // While in dev mode, ensure invulnerability persists
        if (this.devMode) {
            this.player.invulnerable = true;
            this.player.health = Math.max(this.player.health, 1); // Can't die
        }
        
        if (this.engine.wasKeyJustPressed('Escape')) {
            // If any panel is open, close it
            if (this.skillTreePanel.visible || this.inventoryPanel.visible || 
                this.showFullscreenMap) {
                this.skillTreePanel.hide();
                this.inventoryPanel.hide();
                this.showFullscreenMap = false;
            } else if (this.pauseMenu.visible) {
                // If pause menu is open, close it and resume
                this.pauseMenu.hide();
                this.gameState = GameState.PLAYING;
            } else {
                // Open pause menu
                this.pauseMenu.show();
                this.gameState = GameState.PAUSED;
            }
            return;
        }
        
        // If pause menu is open, handle its input and skip game updates
        if (this.pauseMenu.visible) {
            const mouse = this.engine.getMousePosition();
            this.pauseMenu.handleHover(mouse.x, mouse.y);
            
            if (this.engine.wasMouseJustPressed(0)) {
                this.pauseMenu.handleClick(mouse.x, mouse.y);
            }
            
            // Handle slider dragging
            if (this.engine.isMousePressed(0)) {
                this.pauseMenu.handleDrag(mouse.x, mouse.y);
            }
            return;
        }
        
        // If fullscreen map is shown, block other input
        if (this.showFullscreenMap) {
            return;
        }
        
        // If a panel is open, handle its input
        if (this.skillTreePanel.visible) {
            const mouse = this.engine.getMousePosition();
            this.skillTreePanel.handleHover(mouse.x, mouse.y);
            
            if (this.engine.wasMouseJustPressed(0)) {
                this.skillTreePanel.handleClick(mouse.x, mouse.y);
            }
            
            // Handle keyboard navigation
            for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
                               'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter', 'Space']) {
                if (this.engine.wasKeyJustPressed(key)) {
                    this.skillTreePanel.handleKeyDown(key);
                    break;
                }
            }
            
            return;
        }
        
        if (this.inventoryPanel.visible) {
            const mouse = this.engine.getMousePosition();
            this.inventoryPanel.handleHover(mouse.x, mouse.y);
            
            if (this.engine.wasMouseJustPressed(0)) {
                this.inventoryPanel.handleClick(mouse.x, mouse.y);
            }
            
            // Handle keyboard navigation for inventory
            for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
                               'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter', 'Space', 'Tab']) {
                if (this.engine.wasKeyJustPressed(key)) {
                    this.inventoryPanel.handleKeyDown(key);
                    break;
                }
            }
            return;
        }
        
        // Handle puzzle UI if active
        if (this.puzzleUI.visible) {
            this.puzzleUI.update(dt);
            const mouse = this.engine.getMousePosition();
            
            if (this.engine.wasMouseJustPressed(0)) {
                this.puzzleUI.handleClick(mouse.x, mouse.y);
            }
            
            // Allow escape to close puzzle
            if (this.engine.wasKeyJustPressed('Escape')) {
                this.puzzleUI.close();
            }
            
            return; // Block other input while puzzle is active
        }
        
        // Update player controller
        this.controller.update(dt, this.camera);
        
        // Handle pending dash with wall collision checking
        if (this.player.pendingDash) {
            const dash = this.player.pendingDash;
            this.player.pendingDash = null;
            
            // Play dash sound
            this.soundManager.playDash();
            
            // Chain dash visual feedback
            if (this.player.wasChainDash) {
                this.player.wasChainDash = false;
                // Add chain effect - screen flash or notification
                if (this.player.dashChainCount >= 2) {
                    this.uiManager.addNotification(`Chain x${this.player.dashChainCount}!`, 'success');
                }
            }
            
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
        
        // Handle pending teleport (mage) with wall collision checking
        if (this.player.pendingTeleport) {
            const tp = this.player.pendingTeleport;
            this.player.pendingTeleport = null;
            
            // Play teleport sound (use dash sound for now)
            this.soundManager.playDash();
            
            // Calculate target position (5 tiles = 160 pixels)
            const targetX = tp.startX + tp.dirX * tp.distance;
            const targetY = tp.startY + tp.dirY * tp.distance;
            
            // Check if target position is valid, if not find closest valid spot
            let finalX = targetX;
            let finalY = targetY;
            
            if (this.isPositionBlocked(targetX, targetY, this.player.width, this.player.height)) {
                // Walk backwards to find valid position
                const steps = 10;
                const stepBack = tp.distance / steps;
                for (let i = steps - 1; i >= 0; i--) {
                    const testX = tp.startX + tp.dirX * stepBack * i;
                    const testY = tp.startY + tp.dirY * stepBack * i;
                    if (!this.isPositionBlocked(testX, testY, this.player.width, this.player.height)) {
                        finalX = testX;
                        finalY = testY;
                        break;
                    }
                }
            }
            
            // Teleport particles at start location
            this.combatManager.createParticleBurst(tp.startX, tp.startY, 20, {
                color: '#9370db',
                speed: 100,
                lifetime: 0.4,
                size: 4
            });
            
            // Set player to teleport destination
            this.player.x = finalX;
            this.player.y = finalY;
            
            // Teleport particles at end location
            this.combatManager.createParticleBurst(finalX, finalY, 20, {
                color: '#9370db',
                speed: 100,
                lifetime: 0.4,
                size: 4
            });
        }
        
        // Update player
        this.player.update(dt);
        
        // Update potion cooldowns
        if (this.player.potionCooldowns) {
            if (this.player.potionCooldowns.health > 0) {
                this.player.potionCooldowns.health = Math.max(0, this.player.potionCooldowns.health - dt);
            }
            if (this.player.potionCooldowns.mana > 0) {
                this.player.potionCooldowns.mana = Math.max(0, this.player.potionCooldowns.mana - dt);
            }
        }
        
        // Update and spawn player afterimages for cinematic effect
        this.updatePlayerAfterimages(dt);
        
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
            
            // Play class-specific attack sound
            if (attack.attackSound === 'musketShot') {
                this.soundManager.playMusketShot();
            } else if (attack.type === 'projectile') {
                this.soundManager.playArrow();
            } else {
                // Melee swing sound
                this.soundManager.playAttackSound(false);
            }
        }
        
        // Handle player abilities
        if (this.player.pendingAbility) {
            this.executePlayerAbility(this.player.pendingAbility);
            this.player.pendingAbility = null;
        }
        
        // Update player status effects
        this.player.updateStatusEffects?.(dt);
        
        // Non-Euclidean space: wrap player position FIRST (before wall collision)
        // This ensures the player is in valid world coordinates before collision checks
        this.wrapEntityPosition(this.player);
        
        // Collision with dungeon walls (after wrapping)
        this.handleWallCollision(this.player);
        
        // Collision with boss room obstacles
        if (this.bossObstacles && this.bossObstacles.length > 0) {
            this.handleObstacleCollisions(dt);
        }
        
        // Update wrap visual effect
        this.updateWrapGhost(dt);
        
        // Update tile discovery around player
        if (this.dungeon && this.dungeon.discoverArea) {
            this.dungeon.discoverArea(this.player.x, this.player.y, 8);
        }
        
        // Update enemies
        for (const enemy of this.enemies) {
            enemy.update(dt, this.player, this.dungeon);
            
            // Boss dash sound trigger
            if (enemy.playDashSound) {
                this.soundManager.playDash();
                enemy.playDashSound = false;
            }
            
            // Update boss dash trail
            if (enemy.bossDashTrail && enemy.bossDashTrail.length > 0) {
                for (let i = enemy.bossDashTrail.length - 1; i >= 0; i--) {
                    enemy.bossDashTrail[i].time -= dt;
                    enemy.bossDashTrail[i].alpha -= dt * 2.5;
                    if (enemy.bossDashTrail[i].time <= 0) {
                        enemy.bossDashTrail.splice(i, 1);
                    }
                }
            }
            
            // Check for status effect visuals on enemy
            if (enemy.pendingStatusVisual) {
                this.combatManager.addStatusVisual(enemy, enemy.pendingStatusVisual);
                enemy.pendingStatusVisual = null;
            }
            
            // Enemy attacks - support both single attack and array of attacks
            if (enemy.pendingAttack) {
                // Add boss element to ALL attacks for colored effects
                if (enemy.isBoss && enemy.bossElement && !enemy.pendingAttack.element) {
                    enemy.pendingAttack.element = enemy.bossElement;
                }
                this.combatManager.addAttack(enemy.pendingAttack, enemy);
                enemy.pendingAttack = null;
            }
            
            // Handle array of pending attacks (for multi-projectile patterns)
            if (enemy.pendingAttacks && enemy.pendingAttacks.length > 0) {
                for (const attack of enemy.pendingAttacks) {
                    if (enemy.isBoss && enemy.bossElement && !attack.element) {
                        attack.element = enemy.bossElement;
                    }
                    this.combatManager.addAttack(attack, enemy);
                }
                enemy.pendingAttacks = [];
            }
            
            // Boss phase transition mob spawning - spawns around entire arena
            if (enemy.isBoss && enemy.pendingMobSpawn) {
                const spawnCount = 50; // Always spawn 50 minions
                const floorData = FloorEnemies[this.currentFloorTheme];
                let enemyPool = floorData && floorData.enemies ? floorData.enemies : EnemyTypes;
                const availableTypes = Object.keys(enemyPool);
                
                this.uiManager.addNotification('The boss summons a horde!', 'danger');
                this.camera.shake(15, 0.8);
                
                // Get arena bounds
                const arenaCenter = { x: enemy.x, y: enemy.y };
                const arenaRadius = 500; // Larger area for spawning
                
                for (let i = 0; i < spawnCount; i++) {
                    // Spawn in rings around the arena with better spacing
                    const minionsPerRing = 8; // Fewer per ring = more spread out
                    const ring = Math.floor(i / minionsPerRing);
                    const angleOffset = ring * 0.4 + Math.random() * 0.2; // Offset each ring with randomness
                    const angle = (Math.PI * 2 / minionsPerRing) * (i % minionsPerRing) + angleOffset;
                    const spawnRadius = 120 + ring * 90 + Math.random() * 50; // Rings at 120, 210, 300, etc. - more spread
                    
                    // Clamp to arena bounds
                    const clampedRadius = Math.min(spawnRadius, arenaRadius);
                    const spawnX = arenaCenter.x + Math.cos(angle) * clampedRadius;
                    const spawnY = arenaCenter.y + Math.sin(angle) * clampedRadius;
                    
                    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                    const enemyData = enemyPool[type];
                    
                    const minion = new Enemy(type, enemyData, this.currentFloor);
                    minion.x = spawnX;
                    minion.y = spawnY;
                    minion.soundType = enemyData.soundType || 'smallMonsterAttack';
                    minion.isHealingMinion = true; // Mark as healing minion
                    
                    // Make minions tankier and more aggressive
                    minion.health = Math.floor(minion.health * 1.5); // 50% MORE health
                    minion.maxHealth = minion.health;
                    minion.aggroRadius = 600; // Large aggro radius - will chase player from far away
                    minion.attackRange = Math.max(minion.attackRange || 40, 60); // Slightly increased attack range
                    minion.speed = (minion.speed || 80) * 1.2; // 20% faster
                    
                    this.enemies.push(minion);
                    enemy.addHealingMinion(minion); // Register with boss
                }
                
                enemy.pendingMobSpawn = null;
            }
            
            this.handleWallCollision(enemy);
            
            // Wrap enemy positions too (but not bosses during boss fights)
            if (!enemy.isBoss || !this.inBossFight) {
                this.wrapEntityPosition(enemy);
            }
            
            // Check if player entered boss room and start boss fight
            if (enemy.isBoss && !this.inBossFight) {
                const dist = Math.sqrt((this.player.x - enemy.x) ** 2 + (this.player.y - enemy.y) ** 2);
                if (dist < 300) {
                    this.startBossFight(enemy);
                }
            }
        }
        
        // Lock player and boss in boss room during fight
        if (this.inBossFight && this.bossRoom) {
            this.constrainToBossRoom(this.player);
            // Also constrain the boss - with additional safety check
            for (const enemy of this.enemies) {
                if (enemy.isBoss) {
                    // Safety: reset boss to room center if position is invalid (NaN or way outside room)
                    if (!isFinite(enemy.x) || !isFinite(enemy.y)) {
                        enemy.x = (this.bossRoom.x + this.bossRoom.width / 2) * 32;
                        enemy.y = (this.bossRoom.y + this.bossRoom.height / 2) * 32;
                        enemy.velocity.x = 0;
                        enemy.velocity.y = 0;
                    }
                    this.constrainToBossRoom(enemy);
                }
            }
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
                
                // Play attack hit sound
                this.soundManager.playAttackSound(true);
                
                // If player took damage, play hurt sound
                if (result.target === this.player) {
                    this.soundManager.playHurt();
                }
                
                // Cinematic effects on hits - with cooldown to prevent spam
                if (!this.lastHitEffectTime) this.lastHitEffectTime = 0;
                const hitEffectCooldown = Date.now() - this.lastHitEffectTime > 100; // 100ms cooldown
                
                if (result.isCrit && hitEffectCooldown) {
                    this.lastHitEffectTime = Date.now();
                    // Critical hit effects
                    this.camera.shake(8, 0.15);
                    this.camera.impactEffect(1.08, 0.12);
                    // Screen flash and bloom for crits (no hit freeze - too disruptive)
                    this.triggerScreenFlash('#fff', 0.2, 0.06);
                    this.triggerBloom(0.3, 0.1);
                } else if (result.damage > 50 && hitEffectCooldown) {
                    this.lastHitEffectTime = Date.now();
                    // Screen shake on big hits
                    this.camera.shake(5, 0.1);
                    this.camera.impactEffect(1.05, 0.08);
                    this.triggerScreenFlash('#fff', 0.12, 0.05);
                } else if (result.damage > 20 && hitEffectCooldown) {
                    this.lastHitEffectTime = Date.now();
                    // Smaller effect on medium hits
                    this.camera.shake(2, 0.05);
                }
            }
        }
        
        // Check for dead enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.health <= 0) {
                // Award experience
                this.player.gainExperience(enemy.expReward);
                
                // Drop loot - bosses always drop themed weapons
                if (enemy.isBoss) {
                    // Boss guaranteed drop - themed weapon!
                    const bossType = enemy.bossTypeKey || enemy.name.toLowerCase().replace(/\s+/g, '');
                    const bossWeapon = generateBossWeapon(bossType, enemy.level || this.currentFloor * 5);
                    this.items.push({
                        x: enemy.x,
                        y: enemy.y,
                        item: bossWeapon
                    });
                    this.uiManager.addNotification(`${bossWeapon.name} dropped!`, 'legendary');
                } else if (Math.random() < enemy.dropChance) {
                    const weapon = generateEnemyDrop(enemy, this.currentFloor);
                    if (weapon && weapon.name) {
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
                this.soundManager.playCoin();
                
                // If this was a healing minion, remove it from boss tracking
                if (enemy.isHealingMinion) {
                    for (const boss of this.enemies) {
                        if (boss.isBoss && boss.healingMinions) {
                            const minionIndex = boss.healingMinions.indexOf(enemy);
                            if (minionIndex !== -1) {
                                boss.healingMinions.splice(minionIndex, 1);
                                // If all minions dead, boss stops healing
                                if (boss.healingMinions.length === 0) {
                                    boss.isHealingPhase = false;
                                    this.uiManager.addNotification('The boss stops healing!', 'info');
                                }
                            }
                        }
                    }
                }
                
                // Boss kill notification
                if (enemy.isBoss) {
                    this.uiManager.addNotification(`${enemy.name} defeated!`, 'success');
                    this.camera.shake(15, 0.3);
                    this.camera.impactEffect(1.15, 0.3); // Cinematic zoom on boss kill
                    this.camera.slowMo(0.3, 0.4); // Slow motion on boss kill
                    // Big screen flash and bloom for boss kill
                    this.triggerScreenFlash('#fff', 0.5, 0.2);
                    this.triggerBloom(0.6, 0.4);
                    this.triggerHitFreeze(0.05);
                    this.soundManager.stopMusic(); // Stop boss music
                    this.endBossFight(); // Unlock boss room
                    
                    // Check if this was the core boss
                    if (enemy.isCoreBoss) {
                        this.coreBossDefeated = true;
                        this.uiManager.addNotification('The core pulses with energy... Interact to descend!', 'legendary');
                        // Extra safety - ensure music stops
                        this.soundManager.stopMusic();
                    }
                } else if (enemy.isCoreBoss) {
                    // Fallback: if core boss defeated but not marked as boss
                    this.coreBossDefeated = true;
                    this.soundManager.stopMusic();
                    this.endBossFight();
                    this.uiManager.addNotification('The core pulses with energy... Interact to descend!', 'legendary');
                }
                
                this.enemies.splice(i, 1);
                
                // Stop combat sounds when all enemies are defeated
                if (this.enemies.length === 0) {
                    this.soundManager.stopCombatSounds();
                }
            }
        }
        
        // Check for player level up
        if (this.player.justLeveledUp) {
            this.uiManager.addNotification(`Level Up! Now level ${this.player.level}`, 'levelup');
            this.player.justLeveledUp = false;
            this.camera.shake(3, 0.2);
            this.soundManager.playLevelUp?.();
        }
        
        // Show level up allocation screen - freezes game world
        if (this.player.showLevelUpScreen) {
            this.levelUpScreenActive = true;
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
                // Skip invalid items
                if (!item.item || !item.item.name) {
                    this.items.splice(i, 1);
                    continue;
                }
                
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
            // Stairs down - only allow after boss is defeated
            if (this.coreBossDefeated) {
                this.interactionPrompt = 'Press E to descend';
                if (this.engine.wasKeyJustPressed('KeyE')) {
                    this.advanceToNextFloor();
                }
            } else {
                this.interactionPrompt = 'Defeat the floor boss to proceed';
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
            // Trapped chest - looks like a chest but triggers trap when interacted
            this.interactionPrompt = 'Press E to open chest';
            if (this.engine.wasKeyJustPressed('KeyE')) {
                // Trigger trap damage
                const trapDamage = 15 + this.currentFloor * 8;
                this.player.takeDamage(trapDamage);
                this.uiManager.addDamageNumber(this.player.x, this.player.y - 20, trapDamage, false);
                this.uiManager.addNotification('It was a trapped chest!', 'warning');
                this.soundManager.playHit();
                this.camera.shake(8, 0.2);
                // Still give some loot as consolation
                if (Math.random() < 0.5) {
                    const goldAmount = Math.floor(10 + this.currentFloor * 5);
                    this.player.gold = (this.player.gold || 0) + goldAmount;
                    this.uiManager.addNotification(`Found ${goldAmount} gold anyway!`, 'gold');
                }
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
        } else if (currentTile === TILE_TYPES.DUNGEON_CORE) {
            // Dungeon core - triggers boss fight or advance if defeated
            if (this.coreBossDefeated) {
                this.interactionPrompt = 'Press E to descend to the next floor';
                if (this.engine.wasKeyJustPressed('KeyE')) {
                    this.advanceToNextFloor();
                }
            } else if (this.dungeonCoreActivated) {
                // Core has been activated, boss is spawned but not yet defeated
                this.interactionPrompt = 'Defeat the Core Guardian to proceed';
            } else {
                this.interactionPrompt = 'Press E to activate the Dungeon Core';
                if (this.engine.wasKeyJustPressed('KeyE')) {
                    this.activateDungeonCore();
                }
            }
        } else {
            // Reset speed when on normal ground
            this.player.maxSpeed = this.player.baseSpeed;
        }
        
        // Update UI
        this.uiManager.update(dt);
        
        // Camera follow player smoothly with non-euclidean wrap handling
        if (this.dungeon) {
            const worldW = this.dungeon.width * 32;
            const worldH = this.dungeon.height * 32;
            
            // Normal smooth camera follow
            let targetX = this.player.x;
            let targetY = this.player.y;
            
            // Calculate shortest path to target (accounting for world wrapping)
            let dx = targetX - this.camera.x;
            let dy = targetY - this.camera.y;
            
            // If the direct distance is more than half the world, teleport camera
            if (Math.abs(dx) > worldW / 2 || Math.abs(dy) > worldH / 2) {
                // Large jump detected - teleport camera instantly
                this.camera.x = targetX;
                this.camera.y = targetY;
            } else {
                // Smooth follow
                const followSpeed = 5;
                this.camera.x += dx * followSpeed * dt;
                this.camera.y += dy * followSpeed * dt;
            }
            
            // Wrap camera position
            this.camera.x = ((this.camera.x % worldW) + worldW) % worldW;
            this.camera.y = ((this.camera.y % worldH) + worldH) % worldH;
        } else {
            this.camera.smoothFollow(this.player.x, this.player.y, 5, dt);
        }
        this.camera.update(dt);
        
        // ===== SOUND UPDATES =====
        
        // Update heartbeat based on health
        const healthPercent = this.player.health / this.player.maxHealth;
        this.soundManager.updateHeartbeat(healthPercent);
        
        // Start heartbeat if below 50% health
        if (healthPercent < 0.5 && !this.soundManager.heartbeatEnabled) {
            this.soundManager.startHeartbeat();
        } else if (healthPercent >= 0.5 && this.soundManager.heartbeatEnabled) {
            this.soundManager.stopHeartbeat();
        }
        
        // Footstep sounds when moving
        const playerSpeed = Math.sqrt(this.player.velocity.x ** 2 + this.player.velocity.y ** 2);
        if (playerSpeed > 10) {
            this.footstepTimer += dt;
            if (this.footstepTimer >= this.footstepInterval) {
                this.soundManager.playFootstep();
                this.footstepTimer = 0;
            }
        } else {
            this.footstepTimer = 0;
        }
        
        // Random enemy sounds
        this.enemySoundTimer += dt;
        if (this.enemySoundTimer >= this.enemySoundInterval) {
            if (this.enemies.length > 0) {
                const randomEnemy = this.enemies[randomInt(0, this.enemies.length - 1)];
                // Only play if enemy is near player
                const dist = Math.sqrt((randomEnemy.x - this.player.x) ** 2 + (randomEnemy.y - this.player.y) ** 2);
                if (dist < 300) {
                    this.soundManager.play(randomEnemy.soundType || 'smallMonsterAttack', 0.3);
                }
            }
            this.enemySoundTimer = 0;
            // Randomize next interval
            this.enemySoundInterval = 2 + Math.random() * 4;
        }
        
        // Check player death (skip in dev mode)
        if (this.player.health <= 0 && !this.devMode) {
            this.soundManager.playDeath();
            this.soundManager.stopHeartbeat();
            this.soundManager.fadeMusic(2000); // Fade music over 2 seconds
            return GameState.DEAD;
        }
        
        return GameState.PLAYING;
    }
    
    // Execute a player ability with visual effects
    executePlayerAbility(abilityData) {
        const { ability, targetX, targetY, dirX, dirY, startX, startY, owner } = abilityData;
        
        // Create visual particles for ability cast
        this.createAbilityCastEffect(ability, startX, startY);
        
        // Handle different ability types
        switch (ability.type) {
            case 'projectile':
                this.executeProjectileAbility(ability, startX, startY, dirX, dirY, owner);
                break;
            case 'melee':
                this.executeMeleeAbility(ability, startX, startY, targetX, targetY, owner);
                break;
            case 'aoe':
            case 'area':
                this.executeAOEAbility(ability, targetX, targetY, owner);
                break;
            case 'zone':
                // Zone abilities like Blizzard - create persistent damage zone
                this.executeZoneAbility(ability, targetX, targetY, owner);
                break;
            case 'instant':
                this.executeInstantAbility(ability, targetX, targetY, owner);
                break;
            case 'buff':
                this.executeBuffAbility(ability, owner);
                break;
            case 'heal':
                this.executeHealAbility(ability, owner);
                break;
            case 'movement':
            case 'dash':
                this.executeMovementAbility(ability, targetX, targetY, owner);
                break;
            case 'taunt':
                this.executeTauntAbility(ability, owner);
                break;
            case 'debuff':
                this.executeDebuffAbility(ability, targetX, targetY, owner);
                break;
            case 'ultimate':
                // Ultimate abilities - determine effect based on what properties they have
                this.executeUltimateAbility(ability, targetX, targetY, startX, startY, dirX, dirY, owner);
                break;
            default:
                // Treat as projectile if has range, else melee
                if (ability.range && ability.range > 100) {
                    this.executeProjectileAbility(ability, startX, startY, dirX, dirY, owner);
                } else {
                    this.executeMeleeAbility(ability, startX, startY, targetX, targetY, owner);
                }
        }
        
        // Play ability sound
        this.soundManager.playAbilitySound?.(ability.element || 'default');
    }
    
    // Create visual effect at cast location
    createAbilityCastEffect(ability, x, y) {
        const color = this.getElementColor(ability.element);
        
        // Create burst of particles
        this.combatManager.createParticleBurst(x, y, 8, {
            color: color,
            speed: 80,
            size: 5,
            lifetime: 0.3,
            glow: true
        });
    }
    
    // Get color for an element type
    getElementColor(element) {
        const colors = {
            fire: '#ff6600',
            ice: '#66ccff',
            lightning: '#ffff00',
            poison: '#44ff44',
            holy: '#ffffaa',
            dark: '#aa66cc',
            earth: '#8b7355',
            electric: '#88ffff',
            arcane: '#aa88ff',
            physical: '#ffffff',
            default: '#88aaff'
        };
        return colors[element] || colors.default;
    }
    
    // Execute projectile ability (Fireball, Ice Lance, etc.)
    executeProjectileAbility(ability, startX, startY, dirX, dirY, owner) {
        const projectileCount = ability.projectiles || 1;
        const spread = ability.spread || 0.1;
        
        for (let i = 0; i < projectileCount; i++) {
            const angleOffset = (i - (projectileCount - 1) / 2) * spread;
            const angle = Math.atan2(dirY, dirX) + angleOffset;
            
            this.combatManager.addAttack({
                type: 'projectile',
                x: startX,
                y: startY,
                targetX: startX + Math.cos(angle) * (ability.range || 300),
                targetY: startY + Math.sin(angle) * (ability.range || 300),
                damage: ability.damage || 20,
                speed: ability.speed || 400,
                range: ability.range || 300,
                radius: ability.radius || 20,
                element: ability.element,
                homing: ability.homing || false,
                pierce: ability.pierce || false,
                effects: ability.effects,
                isAbility: true
            }, owner);
        }
    }
    
    // Execute melee ability (Shield Bash, Backstab, etc.)
    executeMeleeAbility(ability, startX, startY, targetX, targetY, owner) {
        this.combatManager.addAttack({
            type: 'melee',
            x: startX,
            y: startY,
            targetX: targetX,
            targetY: targetY,
            damage: ability.damage || 25,
            range: ability.range || 60,
            element: ability.element || 'physical',
            knockback: ability.knockback || 80,
            effects: ability.effects,
            isAbility: true
        }, owner);
        
        // Extra particles for melee abilities
        const color = this.getElementColor(ability.element);
        this.combatManager.createParticleBurst(startX, startY, 12, {
            color: color,
            speed: 200,
            size: 6,
            lifetime: 0.25,
            glow: true
        });
    }
    
    // Execute AOE ability (Whirlwind, etc.)
    executeAOEAbility(ability, targetX, targetY, owner) {
        const radius = ability.radius || ability.range || 80;
        const color = this.getElementColor(ability.element);
        
        // Create AOE zone
        this.combatManager.aoeZones.push({
            x: targetX,
            y: targetY,
            radius: radius,
            damage: ability.damage || 30,
            owner: owner,
            element: ability.element,
            lifetime: ability.duration || 0.5,
            maxLifetime: ability.duration || 0.5,
            hitInterval: 0.2,
            lastHitTime: 0,
            hitEntities: new Set(),
            effects: ability.effects
        });
        
        // Visual burst
        this.combatManager.createParticleBurst(targetX, targetY, 20, {
            color: color,
            speed: 150,
            size: 8,
            lifetime: 0.4,
            glow: true
        });
    }
    
    // Execute instant ability (Lightning Bolt chain)
    executeInstantAbility(ability, targetX, targetY, owner) {
        const color = this.getElementColor(ability.element);
        
        // Find target at location
        let target = null;
        let closestDist = ability.range || 250;
        
        for (const enemy of this.enemies) {
            if (!enemy.active) continue;
            const dx = enemy.x - targetX;
            const dy = enemy.y - targetY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                target = enemy;
            }
        }
        
        if (target) {
            // Deal damage
            target.takeDamage(ability.damage || 40);
            
            // Lightning visual - line from player to target
            this.combatManager.particles.push({
                x: owner.x,
                y: owner.y,
                vx: 0, vy: 0,
                size: 3,
                color: color,
                lifetime: 0.15,
                maxLifetime: 0.15,
                isLightning: true,
                targetX: target.x,
                targetY: target.y,
                glow: true
            });
            
            // Chain to additional targets
            if (ability.chainTargets > 0) {
                this.chainLightning(target, ability.chainTargets, ability.damage * 0.6, color, owner);
            }
        }
        
        // Particle burst at target location
        this.combatManager.createParticleBurst(targetX, targetY, 15, {
            color: color,
            speed: 180,
            size: 4,
            lifetime: 0.2,
            glow: true
        });
    }
    
    // Chain lightning to nearby enemies
    chainLightning(source, chainsLeft, damage, color, owner) {
        if (chainsLeft <= 0) return;
        
        let closest = null;
        let closestDist = 150;
        
        for (const enemy of this.enemies) {
            if (!enemy.active || enemy === source) continue;
            const dx = enemy.x - source.x;
            const dy = enemy.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
            }
        }
        
        if (closest) {
            closest.takeDamage(damage);
            
            // Lightning visual
            this.combatManager.particles.push({
                x: source.x,
                y: source.y,
                vx: 0, vy: 0,
                size: 2,
                color: color,
                lifetime: 0.1,
                maxLifetime: 0.1,
                isLightning: true,
                targetX: closest.x,
                targetY: closest.y,
                glow: true
            });
            
            // Continue chain
            this.chainLightning(closest, chainsLeft - 1, damage * 0.6, color, owner);
        }
    }
    
    // Execute buff ability (Defensive Stance, Berserker Rage, etc.)
    executeBuffAbility(ability, owner) {
        const color = this.getElementColor(ability.element || 'arcane');
        
        // Buff particles circling the player
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            this.combatManager.addParticle(
                owner.x + Math.cos(angle) * 30,
                owner.y + Math.sin(angle) * 30,
                {
                    vx: Math.cos(angle) * 50,
                    vy: Math.sin(angle) * 50 - 30,
                    color: color,
                    size: 6,
                    lifetime: 0.6,
                    glow: true
                }
            );
        }
        
        // Rising particles
        this.combatManager.createParticleBurst(owner.x, owner.y, 10, {
            color: color,
            speed: 60,
            size: 5,
            lifetime: 0.8,
            gravity: -50,
            glow: true
        });
        
        // Play buff sound
        this.soundManager.playBuffSound?.();
    }
    
    // Execute heal ability with visual light effect
    executeHealAbility(ability, owner) {
        // Healing light particles rising up
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 25;
            this.combatManager.addParticle(
                owner.x + Math.cos(angle) * dist,
                owner.y + Math.sin(angle) * dist,
                {
                    vx: (Math.random() - 0.5) * 30,
                    vy: -80 - Math.random() * 60,
                    color: '#88ff88',
                    size: 5 + Math.random() * 4,
                    lifetime: 0.8 + Math.random() * 0.4,
                    glow: true
                }
            );
        }
        
        // Golden sparkles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.combatManager.addParticle(
                owner.x + Math.cos(angle) * 20,
                owner.y + Math.sin(angle) * 20,
                {
                    vx: Math.cos(angle) * 40,
                    vy: Math.sin(angle) * 40 - 50,
                    color: '#ffffaa',
                    size: 4,
                    lifetime: 0.5,
                    glow: true
                }
            );
        }
        
        // Play heal sound
        this.soundManager.playHealSound?.();
    }
    
    // Execute movement ability (dash, teleport, etc.)
    executeMovementAbility(ability, targetX, targetY, owner) {
        const dx = targetX - owner.x;
        const dy = targetY - owner.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = ability.distance || ability.range || 150;
        
        const moveDist = Math.min(dist, maxDist);
        const dirX = dx / (dist || 1);
        const dirY = dy / (dist || 1);
        
        // Store original position for particles
        const startX = owner.x;
        const startY = owner.y;
        
        // Move player
        owner.x += dirX * moveDist;
        owner.y += dirY * moveDist;
        
        // Trail particles
        const color = this.getElementColor(ability.element || 'arcane');
        for (let i = 0; i < 15; i++) {
            const t = i / 15;
            this.combatManager.addParticle(
                startX + dirX * moveDist * t,
                startY + dirY * moveDist * t,
                {
                    vx: (Math.random() - 0.5) * 50,
                    vy: (Math.random() - 0.5) * 50,
                    color: color,
                    size: 6 - t * 4,
                    lifetime: 0.3 + Math.random() * 0.2,
                    glow: true
                }
            );
        }
        
        // Arrival burst
        this.combatManager.createParticleBurst(owner.x, owner.y, 10, {
            color: color,
            speed: 100,
            size: 5,
            lifetime: 0.3,
            glow: true
        });
        
        // Brief invulnerability
        owner.setInvulnerable?.(0.1);
    }
    
    // Execute taunt ability
    executeTauntAbility(ability, owner) {
        const range = ability.range || 150;
        
        // Taunt all enemies in range
        for (const enemy of this.enemies) {
            if (!enemy.active) continue;
            const dx = enemy.x - owner.x;
            const dy = enemy.y - owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < range) {
                enemy.tauntedBy = owner;
                enemy.tauntDuration = ability.duration || 5;
            }
        }
        
        // Visual shockwave effect
        this.combatManager.createParticleBurst(owner.x, owner.y, 16, {
            color: '#ff6666',
            speed: 200,
            size: 6,
            lifetime: 0.3,
            glow: true
        });
        
        // Ring of particles
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            this.combatManager.addParticle(
                owner.x + Math.cos(angle) * range * 0.8,
                owner.y + Math.sin(angle) * range * 0.8,
                {
                    vx: Math.cos(angle) * 80,
                    vy: Math.sin(angle) * 80,
                    color: '#ff4444',
                    size: 5,
                    lifetime: 0.4,
                    glow: true
                }
            );
        }
    }
    
    // Execute zone ability (persistent damage areas like Blizzard)
    executeZoneAbility(ability, targetX, targetY, owner) {
        const radius = ability.radius || 150;
        const duration = ability.duration || 6;
        const color = this.getElementColor(ability.element || 'ice');
        
        // Create persistent zone
        this.combatManager.aoeZones.push({
            x: targetX,
            y: targetY,
            radius: radius,
            damage: ability.damage || 15,
            owner: owner,
            element: ability.element || 'ice',
            lifetime: duration,
            maxLifetime: duration,
            hitInterval: 0.5,
            lastHitTime: 0,
            hitEntities: new Set(),
            effects: ability.effects,
            isZone: true
        });
        
        // Visual effect for zone creation
        this.combatManager.createParticleBurst(targetX, targetY, 30, {
            color: color,
            speed: 100,
            size: 6,
            lifetime: 0.5,
            glow: true
        });
    }
    
    // Execute debuff ability
    executeDebuffAbility(ability, targetX, targetY, owner) {
        const range = ability.range || 200;
        const color = this.getElementColor(ability.element || 'dark');
        
        // Apply debuff to enemies in range
        for (const enemy of this.enemies) {
            if (!enemy.active) continue;
            const dx = enemy.x - owner.x;
            const dy = enemy.y - owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < range && ability.effects) {
                for (const effect of ability.effects) {
                    enemy.addStatusEffect?.({
                        type: effect.type,
                        value: effect.value,
                        duration: effect.duration || ability.duration || 8,
                        source: 'ability'
                    });
                }
            }
        }
        
        // Visual wave effect
        this.combatManager.createParticleBurst(owner.x, owner.y, 20, {
            color: color,
            speed: 150,
            size: 5,
            lifetime: 0.4,
            glow: true
        });
    }
    
    // Execute ultimate ability (special powerful abilities)
    executeUltimateAbility(ability, targetX, targetY, startX, startY, dirX, dirY, owner) {
        const color = this.getElementColor(ability.element || 'arcane');
        
        // Ultimates can be different things based on their properties
        // Check if it has damage and radius (AOE ultimate like Elemental Storm)
        if (ability.damage && ability.radius) {
            // Large AOE attack
            this.executeAOEAbility(ability, targetX, targetY, owner);
            
            // Extra dramatic particles for ultimate
            for (let i = 0; i < 30; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * ability.radius;
                this.combatManager.addParticle(
                    targetX + Math.cos(angle) * dist,
                    targetY + Math.sin(angle) * dist,
                    {
                        vx: Math.cos(angle) * 100,
                        vy: -80 + Math.random() * 60,
                        color: color,
                        size: 6 + Math.random() * 4,
                        lifetime: 0.8,
                        glow: true
                    }
                );
            }
        }
        // Check if it has duration (buff ultimate like Bulwark)
        else if (ability.duration) {
            // Apply ultimate buff
            owner.addStatusEffect?.({
                type: 'ultimate_buff',
                value: 1,
                duration: ability.duration,
                source: 'ultimate'
            });
            
            // Invulnerability if this is a defensive ultimate
            if (ability.name && ability.name.toLowerCase().includes('bulwark')) {
                owner.setInvulnerable?.(ability.duration);
            }
            
            // Dramatic buff visuals
            this.executeBuffAbility(ability, owner);
            
            // Extra particles rising
            for (let i = 0; i < 20; i++) {
                this.combatManager.addParticle(
                    owner.x + (Math.random() - 0.5) * 40,
                    owner.y + (Math.random() - 0.5) * 40,
                    {
                        vx: (Math.random() - 0.5) * 60,
                        vy: -100 - Math.random() * 80,
                        color: color,
                        size: 5 + Math.random() * 3,
                        lifetime: 1.0,
                        glow: true
                    }
                );
            }
        }
        // Fallback - treat as powerful melee/projectile
        else {
            if (ability.range && ability.range > 100) {
                this.executeProjectileAbility(ability, startX, startY, dirX, dirY, owner);
            } else {
                this.executeMeleeAbility(ability, startX, startY, targetX, targetY, owner);
            }
        }
        
        // Play special ultimate sound
        this.soundManager.playAbilitySound?.('ultimate');
    }

    handleWallCollision(entity) {
        const halfW = entity.width / 2;
        const halfH = entity.height / 2;
        const tileSize = 32;
        
        // Store old position to revert if needed
        const oldX = entity.prevX !== undefined ? entity.prevX : entity.x;
        const oldY = entity.prevY !== undefined ? entity.prevY : entity.y;
        
        // Calculate movement delta for sliding
        const moveX = entity.x - oldX;
        const moveY = entity.y - oldY;
        
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
        
        // Wall sliding: preserve momentum on non-collided axis
        // Instead of just stopping, slide along the wall
        if (collidedX && !collidedY) {
            // Hit horizontal wall, slide vertically
            entity.x = oldX;
            // Keep Y movement (slide along wall)
            // Add a small slide factor to preserve some momentum feel
            if (entity.vx !== undefined && Math.abs(moveX) > 0) {
                entity.slideVelocityY = (entity.slideVelocityY || 0) + moveX * 0.3;
                entity.y += entity.slideVelocityY * 0.016; // Apply slide
            }
        } else if (collidedY && !collidedX) {
            // Hit vertical wall, slide horizontally
            entity.y = oldY;
            // Keep X movement (slide along wall)
            if (entity.vy !== undefined && Math.abs(moveY) > 0) {
                entity.slideVelocityX = (entity.slideVelocityX || 0) + moveY * 0.3;
                entity.x += entity.slideVelocityX * 0.016; // Apply slide
            }
        } else if (collidedX && collidedY) {
            // Hit corner, revert both
            entity.x = oldX;
            entity.y = oldY;
        }
        
        // Decay slide velocity over time
        if (entity.slideVelocityX) {
            entity.slideVelocityX *= 0.85;
            if (Math.abs(entity.slideVelocityX) < 0.1) entity.slideVelocityX = 0;
        }
        if (entity.slideVelocityY) {
            entity.slideVelocityY *= 0.85;
            if (Math.abs(entity.slideVelocityY) < 0.1) entity.slideVelocityY = 0;
        }
        
        // Final safety check - if still in wall, push out
        const finalCheckPoints = [
            { x: entity.x - halfW + 2, y: entity.y - halfH + 2 },
            { x: entity.x + halfW - 2, y: entity.y - halfH + 2 },
            { x: entity.x - halfW + 2, y: entity.y + halfH - 2 },
            { x: entity.x + halfW - 2, y: entity.y + halfH - 2 }
        ];
        
        for (const point of finalCheckPoints) {
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
    
    // Handle collisions with boss room obstacles
    handleObstacleCollisions(dt) {
        const player = this.player;
        const playerRadius = player.width / 2;
        
        for (let i = this.bossObstacles.length - 1; i >= 0; i--) {
            const obstacle = this.bossObstacles[i];
            
            if (obstacle.type === 'pillar') {
                // Pillar collision - push player away
                const hw = obstacle.width / 2;
                const hh = obstacle.height / 2;
                
                // AABB collision check
                const dx = player.x - obstacle.x;
                const dy = player.y - obstacle.y;
                const overlapX = hw + playerRadius - Math.abs(dx);
                const overlapY = hh + playerRadius - Math.abs(dy);
                
                if (overlapX > 0 && overlapY > 0) {
                    // Collision! Push player out on the axis with less overlap
                    if (overlapX < overlapY) {
                        player.x += (dx > 0 ? overlapX : -overlapX);
                    } else {
                        player.y += (dy > 0 ? overlapY : -overlapY);
                    }
                }
                
                // Check enemy attacks on pillars
                if (obstacle.destructible) {
                    for (const projectile of this.projectiles) {
                        if (projectile.isEnemyProjectile) {
                            const pdx = projectile.x - obstacle.x;
                            const pdy = projectile.y - obstacle.y;
                            if (Math.abs(pdx) < hw + 8 && Math.abs(pdy) < hh + 8) {
                                obstacle.health -= 25;
                                projectile.expired = true;
                                this.combatManager.addDamageNumber(obstacle.x, obstacle.y - 20, 25, '#888');
                                this.camera.shake(3, 0.1);
                                
                                if (obstacle.health <= 0) {
                                    // Pillar destroyed
                                    this.bossObstacles.splice(i, 1);
                                    this.soundManager.play('hit', 0.5);
                                    // Add destruction particles
                                    for (let j = 0; j < 8; j++) {
                                        this.combatManager.addEffect({
                                            x: obstacle.x + (Math.random() - 0.5) * 30,
                                            y: obstacle.y + (Math.random() - 0.5) * 30,
                                            type: 'debris',
                                            duration: 0.5,
                                            color: '#666'
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (obstacle.type === 'hazard') {
                // Hazard damage - check if player is inside
                const dx = player.x - obstacle.x;
                const dy = player.y - obstacle.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < obstacle.radius + playerRadius - 5) {
                    // Player is in hazard
                    if (!player.invulnerable) {
                        const damage = obstacle.damage * dt * 2; // Damage per second
                        player.takeDamage(damage);
                        
                        // Push player slightly out of hazard
                        if (dist > 0) {
                            const pushForce = 30 * dt;
                            player.x += (dx / dist) * pushForce;
                            player.y += (dy / dist) * pushForce;
                        }
                    }
                }
            }
        }
    }
    
    // Non-Euclidean space: wrap entity position to keep it within world bounds
    wrapEntityPosition(entity) {
        if (!this.dungeon) return;
        
        const worldW = this.dungeon.width * 32;
        const worldH = this.dungeon.height * 32;
        const edgeThreshold = 32; // Distance from edge to start showing ghost
        
        // Calculate wrapped position
        const wrappedX = ((entity.x % worldW) + worldW) % worldW;
        const wrappedY = ((entity.y % worldH) + worldH) % worldH;
        
        // Check if entity crossed the boundary (not just near it)
        const crossedX = entity.x < 0 || entity.x >= worldW;
        const crossedY = entity.y < 0 || entity.y >= worldH;
        
        // For player with active ghost: complete the teleport
        if (entity === this.player && this.wrapGhost.active) {
            this.wrapGhost.timer += 0; // Timer updated in updateWrapGhost
            
            // Ghost position mirrors player movement on other side
            // Ghost X/Y are updated in updateWrapGhost based on player velocity
        }
        
        // For player: check if we need to start ghost or complete teleport
        if (entity === this.player) {
            // Check if near edge (show ghost)
            const nearLeftEdge = wrappedX < edgeThreshold;
            const nearRightEdge = wrappedX > worldW - edgeThreshold;
            const nearTopEdge = wrappedY < edgeThreshold;
            const nearBottomEdge = wrappedY > worldH - edgeThreshold;
            
            // If crossed boundary, teleport instantly
            if (crossedX || crossedY) {
                entity.x = wrappedX;
                entity.y = wrappedY;
                entity.prevX = wrappedX;
                entity.prevY = wrappedY;
                this.camera.x = wrappedX;
                this.camera.y = wrappedY;
                this.wrapGhost.active = false;
                
                if (entity.dashTrail) {
                    entity.dashTrail = [];
                }
                return;
            }
            
            // Start ghost if near edge and not already active
            if ((nearLeftEdge || nearRightEdge || nearTopEdge || nearBottomEdge) && !this.wrapGhost.active) {
                this.wrapGhost.active = true;
                this.wrapGhost.timer = 0;
                this.wrapGhost.wrapX = nearLeftEdge || nearRightEdge;
                this.wrapGhost.wrapY = nearTopEdge || nearBottomEdge;
                
                // Calculate ghost position on opposite side
                if (nearLeftEdge) {
                    this.wrapGhost.x = wrappedX + worldW;
                } else if (nearRightEdge) {
                    this.wrapGhost.x = wrappedX - worldW;
                } else {
                    this.wrapGhost.x = wrappedX;
                }
                
                if (nearTopEdge) {
                    this.wrapGhost.y = wrappedY + worldH;
                } else if (nearBottomEdge) {
                    this.wrapGhost.y = wrappedY - worldH;
                } else {
                    this.wrapGhost.y = wrappedY;
                }
            }
            
            // Stop ghost if moved away from edge
            if (this.wrapGhost.active && !nearLeftEdge && !nearRightEdge && !nearTopEdge && !nearBottomEdge) {
                this.wrapGhost.active = false;
            }
        } else {
            // Non-player: just wrap position
            entity.x = wrappedX;
            entity.y = wrappedY;
        }
    }
    
    // Update wrap ghost - mirrors player movement, then teleports player
    updateWrapGhost(dt) {
        if (!this.wrapGhost.active) return;
        if (!this.dungeon) return;
        
        const worldW = this.dungeon.width * 32;
        const worldH = this.dungeon.height * 32;
        
        // Ghost position = player position + world offset (mirrors exactly)
        const playerX = this.player.x;
        const playerY = this.player.y;
        
        // Calculate which side the ghost should be on
        const wrappedX = ((playerX % worldW) + worldW) % worldW;
        const wrappedY = ((playerY % worldH) + worldH) % worldH;
        
        // Update ghost to mirror player on opposite side
        if (wrappedX < worldW / 2) {
            this.wrapGhost.x = wrappedX + worldW;
        } else {
            this.wrapGhost.x = wrappedX - worldW;
        }
        
        if (wrappedY < worldH / 2) {
            this.wrapGhost.y = wrappedY + worldH;
        } else {
            this.wrapGhost.y = wrappedY - worldH;
        }
        
        this.wrapGhost.timer += dt;
        
        // After delay, teleport player to ghost position (wrapped)
        if (this.wrapGhost.timer >= this.wrapGhost.delay) {
            // Only teleport if player is still near edge
            const edgeThreshold = 32;
            const nearEdge = wrappedX < edgeThreshold || wrappedX > worldW - edgeThreshold ||
                            wrappedY < edgeThreshold || wrappedY > worldH - edgeThreshold;
            
            if (nearEdge) {
                // Teleport to ghost position (wrapped into world bounds)
                const ghostWrappedX = ((this.wrapGhost.x % worldW) + worldW) % worldW;
                const ghostWrappedY = ((this.wrapGhost.y % worldH) + worldH) % worldH;
                
                this.player.x = ghostWrappedX;
                this.player.y = ghostWrappedY;
                this.player.prevX = ghostWrappedX;
                this.player.prevY = ghostWrappedY;
                this.camera.x = ghostWrappedX;
                this.camera.y = ghostWrappedY;
                
                if (this.player.dashTrail) {
                    this.player.dashTrail = [];
                }
            }
            
            this.wrapGhost.active = false;
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
    
    // Start boss fight - lock player in room
    startBossFight(boss) {
        this.inBossFight = true;
        
        // Set boss on HUD for big health bar
        this.hud.setBoss(boss);
        
        // Find the room the boss is in
        const bossTileX = Math.floor(boss.x / 32);
        const bossTileY = Math.floor(boss.y / 32);
        
        for (const room of this.dungeon.rooms) {
            if (bossTileX >= room.x && bossTileX < room.x + room.width &&
                bossTileY >= room.y && bossTileY < room.y + room.height) {
                this.bossRoom = room;
                break;
            }
        }
        
        // Fallback: if no room found, use the core room (where boss should be)
        if (!this.bossRoom && this.dungeon.coreRoom) {
            this.bossRoom = this.dungeon.coreRoom;
            // Also move boss to room center to ensure it's inside
            boss.x = (this.bossRoom.x + this.bossRoom.width / 2) * 32;
            boss.y = (this.bossRoom.y + this.bossRoom.height / 2) * 32;
        }
        
        // If we found a boss room, lock it
        if (this.bossRoom) {
            this.bossRoomLocked = true;
            this.uiManager.addNotification('The room seals behind you!', 'warning');
            this.camera.shake(10, 0.5);
            
            // Spawn stage obstacles for the boss fight
            this.spawnBossRoomObstacles(this.bossRoom, boss);
        }
    }
    
    // Spawn obstacles in boss room for tactical gameplay
    spawnBossRoomObstacles(room, boss) {
        this.bossObstacles = [];
        
        // Get floor theme for obstacle styling
        const theme = this.currentFloorTheme || 'crypt';
        
        // Calculate room center and dimensions
        const centerX = (room.x + room.width / 2) * 32;
        const centerY = (room.y + room.height / 2) * 32;
        const roomW = room.width * 32;
        const roomH = room.height * 32;
        
        // Create 4 pillars in corners for cover
        const pillarOffset = 80;
        const pillarPositions = [
            { x: centerX - roomW/3 + pillarOffset, y: centerY - roomH/3 + pillarOffset },
            { x: centerX + roomW/3 - pillarOffset, y: centerY - roomH/3 + pillarOffset },
            { x: centerX - roomW/3 + pillarOffset, y: centerY + roomH/3 - pillarOffset },
            { x: centerX + roomW/3 - pillarOffset, y: centerY + roomH/3 - pillarOffset },
        ];
        
        for (const pos of pillarPositions) {
            this.bossObstacles.push({
                type: 'pillar',
                x: pos.x,
                y: pos.y,
                width: 32,
                height: 32,
                health: 100,
                destructible: true,
                theme: theme
            });
        }
        
        // Add themed hazards based on floor type
        const hazardCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < hazardCount; i++) {
            // Random position within room but not too close to center or edges
            const angle = (i / hazardCount) * Math.PI * 2 + Math.random() * 0.5;
            const dist = roomW / 4 + Math.random() * roomW / 6;
            const hx = centerX + Math.cos(angle) * dist;
            const hy = centerY + Math.sin(angle) * dist;
            
            // Determine hazard type by theme
            let hazardType = 'fire_pit';
            let damage = 10;
            let color = '#ff4400';
            
            switch(theme) {
                case 'crypt':
                    hazardType = 'grave_spike';
                    color = '#444';
                    damage = 15;
                    break;
                case 'cavern':
                    hazardType = 'lava_pool';
                    color = '#ff3300';
                    damage = 20;
                    break;
                case 'sewer':
                    hazardType = 'acid_pool';
                    color = '#44ff44';
                    damage = 12;
                    break;
                case 'fortress':
                    hazardType = 'spike_trap';
                    color = '#666';
                    damage = 18;
                    break;
                case 'temple':
                    hazardType = 'holy_fire';
                    color = '#ffdd00';
                    damage = 8;
                    break;
                case 'void':
                    hazardType = 'void_rift';
                    color = '#8800ff';
                    damage = 25;
                    break;
            }
            
            this.bossObstacles.push({
                type: 'hazard',
                hazardType: hazardType,
                x: hx,
                y: hy,
                radius: 24 + Math.random() * 16,
                damage: damage,
                color: color,
                pulsePhase: Math.random() * Math.PI * 2,
                theme: theme
            });
        }
    }
    
    // End boss fight - unlock room
    endBossFight() {
        this.inBossFight = false;
        this.bossRoomLocked = false;
        this.bossRoom = null;
        this.bossObstacles = []; // Clear obstacles when fight ends
        this.hud.setBoss(null); // Clear boss health bar
    }
    
    // Constrain entity to boss room bounds
    constrainToBossRoom(entity) {
        if (!this.bossRoom) return;
        
        const room = this.bossRoom;
        const margin = 16; // Keep away from walls
        
        const minX = room.x * 32 + margin;
        const maxX = (room.x + room.width) * 32 - margin;
        const minY = room.y * 32 + margin;
        const maxY = (room.y + room.height) * 32 - margin;
        
        entity.x = Math.max(minX, Math.min(maxX, entity.x));
        entity.y = Math.max(minY, Math.min(maxY, entity.y));
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
        
        // Render boss room obstacles
        if (this.bossObstacles && this.bossObstacles.length > 0) {
            this.renderBossObstacles(ctx);
        }
        
        // Render enemies
        for (const enemy of this.enemies) {
            this.renderEnemy(ctx, enemy);
        }
        
        // Render wrap transition ghost (appears before player during transition)
        if (this.wrapGhost.active) {
            this.renderWrapGhost(ctx);
        }
        
        // Render player afterimages (behind player)
        this.renderPlayerAfterimages(ctx);
        
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
        
        // Render fullscreen map if toggled
        if (this.showFullscreenMap && this.dungeon) {
            this.dungeonRenderer.renderFullscreenMap(
                ctx, 
                this.dungeon, 
                this.player.x, 
                this.player.y,
                ctx.canvas.width,
                ctx.canvas.height
            );
        }
        
        // Render panels
        this.skillTreePanel.render(ctx);
        this.inventoryPanel.render(ctx);
        
        // Render pause menu (on top of everything else)
        this.pauseMenu.render(ctx);
        
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
        
        // Controls hint removed per request
        
        // Render puzzle UI overlay
        this.puzzleUI.render(ctx);
        
        // Render low health vignette
        this.renderHealthVignette(ctx);
        
        // Render screen combat effects (flash, bloom)
        this.renderScreenEffects(ctx);
        
        // Render level up screen overlay (on top of everything)
        this.renderLevelUpScreen(ctx);
        
        // Render weapon cursor at mouse position
        this.renderWeaponCursor(ctx);
    }
    
    // Render red vignette when player is low on health
    renderHealthVignette(ctx) {
        const healthPercent = this.player.health / this.player.maxHealth;
        
        if (healthPercent < 0.4) {
            const intensity = 1 - (healthPercent / 0.4); // 0 at 40%, 1 at 0%
            const pulse = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
            const alpha = intensity * 0.5 * pulse;
            
            // Create radial gradient from transparent center to red edges
            const gradient = ctx.createRadialGradient(
                ctx.canvas.width / 2, ctx.canvas.height / 2, ctx.canvas.width * 0.2,
                ctx.canvas.width / 2, ctx.canvas.height / 2, ctx.canvas.width * 0.7
            );
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
            gradient.addColorStop(0.5, `rgba(255, 0, 0, ${alpha * 0.3})`);
            gradient.addColorStop(1, `rgba(180, 0, 0, ${alpha})`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            // Add pulsing border for critical health
            if (healthPercent < 0.2) {
                ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
                ctx.lineWidth = 8 + Math.sin(Date.now() * 0.01) * 4;
                ctx.strokeRect(4, 4, ctx.canvas.width - 8, ctx.canvas.height - 8);
            }
        }
    }
    
    // Trigger a screen flash effect (for big hits, kills, etc.)
    triggerScreenFlash(color = '#fff', intensity = 0.3, duration = 0.1) {
        // Check if screen flash is enabled in settings
        if (!this.visualSettings.screenFlash) return;
        // Clamp intensity and duration for performance
        intensity = Math.min(intensity, 0.4);
        duration = Math.max(duration, 0.05);
        this.screenEffects.flashColor = color;
        this.screenEffects.flashAlpha = intensity;
        this.screenEffects.flashDecay = intensity / duration;
    }
    
    // Return to main menu (called from pause menu)
    returnToMainMenu() {
        this.quitToMenu = true;
        // Stop music
        if (this.soundManager) {
            this.soundManager.stopMusic();
        }
    }
    
    // Trigger hit freeze (brief pause for impact)
    triggerHitFreeze(duration = 0.03) {
        // Check if hit freeze is enabled in settings
        if (!this.visualSettings.hitFreeze) return;
        this.screenEffects.hitFreeze = duration;
    }
    
    // Trigger screen shake (respects settings)
    triggerScreenShake(intensity, duration) {
        if (!this.visualSettings.screenShake) return;
        this.camera.shake(intensity, duration);
    }
    
    // Trigger bloom effect
    triggerBloom(intensity = 0.3, duration = 0.2) {
        this.screenEffects.bloomIntensity = intensity;
        this.screenEffects.bloomDecay = intensity / duration;
    }
    
    // Update screen effects
    updateScreenEffects(dt) {
        // Decay flash
        if (this.screenEffects.flashAlpha > 0) {
            this.screenEffects.flashAlpha -= this.screenEffects.flashDecay * dt;
            if (this.screenEffects.flashAlpha < 0) this.screenEffects.flashAlpha = 0;
        }
        
        // Decay bloom
        if (this.screenEffects.bloomIntensity > 0) {
            this.screenEffects.bloomIntensity -= this.screenEffects.bloomDecay * dt;
            if (this.screenEffects.bloomIntensity < 0) this.screenEffects.bloomIntensity = 0;
        }
        
        // Hit freeze (returns true if should pause game) - skip if disabled
        if (this.screenEffects.hitFreeze > 0 && this.visualSettings.hitFreeze) {
            this.screenEffects.hitFreeze -= dt;
            // Only freeze for very short durations to avoid perceived lag
            if (this.screenEffects.hitFreeze > 0.05) {
                this.screenEffects.hitFreeze = 0.05; // Cap at 50ms
            }
            return true; // Pause update while in hit freeze
        }
        this.screenEffects.hitFreeze = 0;
        return false;
    }
    
    // Level up screen - allows player to allocate stat points
    updateLevelUpScreen() {
        const canvas = this.engine.canvas;
        const stats = ['strength', 'agility', 'intelligence', 'vitality', 'luck'];
        
        // Handle number key presses for stat allocation
        if (this.engine.wasKeyJustPressed('Digit1') || this.engine.wasKeyJustPressed('Numpad1')) {
            this.player.allocateStat('strength');
            this.soundManager.playCoin?.();
        }
        if (this.engine.wasKeyJustPressed('Digit2') || this.engine.wasKeyJustPressed('Numpad2')) {
            this.player.allocateStat('agility');
            this.soundManager.playCoin?.();
        }
        if (this.engine.wasKeyJustPressed('Digit3') || this.engine.wasKeyJustPressed('Numpad3')) {
            this.player.allocateStat('intelligence');
            this.soundManager.playCoin?.();
        }
        if (this.engine.wasKeyJustPressed('Digit4') || this.engine.wasKeyJustPressed('Numpad4')) {
            this.player.allocateStat('vitality');
            this.soundManager.playCoin?.();
        }
        if (this.engine.wasKeyJustPressed('Digit5') || this.engine.wasKeyJustPressed('Numpad5')) {
            this.player.allocateStat('luck');
            this.soundManager.playCoin?.();
        }
        
        // Close level up screen when all stat points are spent or Enter/Space pressed
        if (this.player.statPoints <= 0 || 
            this.engine.wasKeyJustPressed('Enter') || 
            this.engine.wasKeyJustPressed('Space')) {
            if (this.player.statPoints <= 0) {
                this.levelUpScreenActive = false;
                this.player.showLevelUpScreen = false;
            }
        }
        
        // Allow early exit with Escape (skip remaining points)
        if (this.engine.wasKeyJustPressed('Escape')) {
            this.levelUpScreenActive = false;
            this.player.showLevelUpScreen = false;
        }
    }
    
    // Render level up screen overlay
    renderLevelUpScreen(ctx) {
        if (!this.levelUpScreenActive) return;
        
        const canvas = ctx.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Darken background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Panel
        const panelWidth = 450;
        const panelHeight = 400;
        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;
        
        // Panel background
        ctx.fillStyle = 'rgba(30, 30, 50, 0.95)';
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 3;
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Title
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`LEVEL UP! Level ${this.player.level}`, centerX, panelY + 45);
        
        // Stat points remaining
        ctx.fillStyle = '#88ff88';
        ctx.font = '20px Arial';
        ctx.fillText(`Stat Points: ${this.player.statPoints}`, centerX, panelY + 80);
        
        // Stats list
        const stats = [
            { key: 'strength', name: 'Strength', desc: '+2 Attack Damage', color: '#ff6666' },
            { key: 'agility', name: 'Agility', desc: '+2 Speed, +2 Stamina', color: '#66ff66' },
            { key: 'intelligence', name: 'Intelligence', desc: '+3 Magic Damage, +5 Mana', color: '#6666ff' },
            { key: 'vitality', name: 'Vitality', desc: '+10 HP, +1 Defense', color: '#ffff66' },
            { key: 'luck', name: 'Luck', desc: '+0.5% Crit Chance', color: '#ff66ff' }
        ];
        
        const startY = panelY + 120;
        const lineHeight = 50;
        
        ctx.textAlign = 'left';
        stats.forEach((stat, i) => {
            const y = startY + i * lineHeight;
            const value = Math.floor(this.player.stats[stat.key]);
            
            // Key number
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.fillText(`[${i + 1}]`, panelX + 20, y);
            
            // Stat name
            ctx.fillStyle = stat.color;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(stat.name, panelX + 60, y);
            
            // Current value
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px Arial';
            ctx.fillText(`${value}`, panelX + 200, y);
            
            // Description
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '14px Arial';
            ctx.fillText(stat.desc, panelX + 250, y);
        });
        
        // Instructions
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888888';
        ctx.font = '14px Arial';
        ctx.fillText('Press 1-5 to allocate points', centerX, panelY + panelHeight - 50);
        ctx.fillText('Press ESC to skip remaining points', centerX, panelY + panelHeight - 30);
        
        // Also show skill points available
        if (this.player.skillPoints > 0) {
            ctx.fillStyle = '#aaffaa';
            ctx.font = '16px Arial';
            ctx.fillText(`Skill Points: ${this.player.skillPoints} (Press K to open skill tree)`, centerX, panelY + panelHeight - 10);
        }
    }
    
    // Render screen combat effects
    renderScreenEffects(ctx) {
        const se = this.screenEffects;
        
        // Screen flash overlay
        if (se.flashAlpha > 0 && se.flashColor) {
            ctx.globalAlpha = se.flashAlpha;
            ctx.fillStyle = se.flashColor;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.globalAlpha = 1;
        }
        
        // Bloom/glow effect (radial glow from center)
        if (se.bloomIntensity > 0) {
            const gradient = ctx.createRadialGradient(
                ctx.canvas.width / 2, ctx.canvas.height / 2, 0,
                ctx.canvas.width / 2, ctx.canvas.height / 2, ctx.canvas.width * 0.6
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${se.bloomIntensity * 0.5})`);
            gradient.addColorStop(0.5, `rgba(255, 255, 200, ${se.bloomIntensity * 0.2})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
    
    // Update and spawn player afterimages
    updatePlayerAfterimages(dt) {
        const p = this.player;
        
        // Spawn afterimages when attacking or dashing
        const isAttacking = p.attackCooldown > 0;
        const isDashing = p.isDashing;
        const isMovingFast = Math.sqrt(p.velocity.x**2 + p.velocity.y**2) > 150;
        
        if (isAttacking || isDashing || isMovingFast) {
            this.afterimageTimer += dt;
            // Spawn afterimage every 0.03 seconds during action
            if (this.afterimageTimer >= 0.03) {
                this.afterimageTimer = 0;
                this.playerAfterimages.push({
                    x: p.x,
                    y: p.y,
                    width: p.width,
                    height: p.height,
                    alpha: 0.6,
                    lifetime: 0.3,
                    color: ClassDefinitions[this.selectedClass]?.color || '#4488ff',
                    facingX: p.facingX || 1
                });
            }
        }
        
        // Update existing afterimages
        for (let i = this.playerAfterimages.length - 1; i >= 0; i--) {
            const img = this.playerAfterimages[i];
            img.lifetime -= dt;
            img.alpha = (img.lifetime / 0.3) * 0.6;
            
            if (img.lifetime <= 0) {
                this.playerAfterimages.splice(i, 1);
            }
        }
    }
    
    // Render player afterimages (called before player render)
    renderPlayerAfterimages(ctx) {
        for (const img of this.playerAfterimages) {
            // Use world coordinates directly - camera transform is already applied
            ctx.save();
            ctx.globalAlpha = img.alpha;
            ctx.translate(img.x, img.y);
            ctx.scale(img.facingX, 1);
            
            // Ghost body with glow
            ctx.shadowColor = img.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = img.color;
            ctx.globalAlpha = img.alpha * 0.5;
            ctx.fillRect(-img.width/2, -img.height/2, img.width, img.height);
            
            // Outline
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.globalAlpha = img.alpha * 0.3;
            ctx.strokeRect(-img.width/2, -img.height/2, img.width, img.height);
            
            ctx.restore();
        }
    }
    
    // Render the equipped weapon at the mouse cursor position
    renderWeaponCursor(ctx) {
        const mouse = this.engine.getMousePosition();
        const p = this.player;
        const weapon = p.equipment?.weapon;
        const classData = ClassDefinitions[this.selectedClass];
        
        // Calculate angle from player to cursor (in screen space)
        const playerScreen = this.camera.worldToScreen(p.x, p.y);
        const dx = mouse.x - playerScreen.x;
        const dy = mouse.y - playerScreen.y;
        const angle = Math.atan2(dy, dx);
        
        const isAttacking = p.attackCooldown > 0;
        const swingPhase = isAttacking ? (p.attackCooldown / 0.5) * Math.PI : 0;
        
        ctx.save();
        ctx.translate(mouse.x, mouse.y);
        ctx.rotate(angle);
        
        // Swing animation
        if (isAttacking) {
            ctx.rotate(-swingPhase + Math.PI / 4);
        }
        
        const weaponType = weapon?.type || classData.weaponTypes?.[0] || 'sword';
        const weaponColor = weapon?.color || '#aaaaaa';
        
        // Scale up the weapon for cursor visibility
        ctx.scale(1.2, 1.2);
        
        // Draw weapon based on type
        this.drawWeaponShape(ctx, weaponType, weaponColor, classData, isAttacking);
        
        ctx.restore();
        
        // Draw small crosshair at exact cursor point
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mouse.x - 4, mouse.y);
        ctx.lineTo(mouse.x + 4, mouse.y);
        ctx.moveTo(mouse.x, mouse.y - 4);
        ctx.lineTo(mouse.x, mouse.y + 4);
        ctx.stroke();
    }
    
    // Shared weapon drawing function
    drawWeaponShape(ctx, weaponType, weaponColor, classData, isAttacking) {
        switch (weaponType) {
            case 'sword':
            case 'enchanted_sword':
                ctx.fillStyle = '#c0c0c0';
                ctx.beginPath();
                ctx.moveTo(0, -2);
                ctx.lineTo(22, -3);
                ctx.lineTo(25, 0);
                ctx.lineTo(22, 3);
                ctx.lineTo(0, 2);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(2, -1);
                ctx.lineTo(22, -2);
                ctx.stroke();
                ctx.fillStyle = '#8b4513';
                ctx.fillRect(-2, -5, 4, 10);
                ctx.fillStyle = '#4a3520';
                ctx.fillRect(-8, -2, 6, 4);
                ctx.fillStyle = weaponColor;
                ctx.beginPath();
                ctx.arc(-9, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'katana':
                ctx.strokeStyle = '#e8e8e8';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(15, -4, 28, -2);
                ctx.stroke();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(2, -1);
                ctx.quadraticCurveTo(15, -5, 27, -3);
                ctx.stroke();
                ctx.fillStyle = '#2a2a2a';
                ctx.beginPath();
                ctx.ellipse(-1, 0, 4, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1a1a2a';
                ctx.fillRect(-12, -2, 11, 4);
                for (let i = 0; i < 3; i++) {
                    ctx.fillStyle = '#daa520';
                    ctx.fillRect(-11 + i * 4, -2, 2, 4);
                }
                break;
                
            case 'axe':
            case 'runic_axe':
                ctx.fillStyle = '#5a4030';
                ctx.fillRect(-4, -2, 20, 4);
                ctx.fillStyle = '#707070';
                ctx.beginPath();
                ctx.moveTo(14, -2);
                ctx.lineTo(22, -10);
                ctx.lineTo(26, -8);
                ctx.lineTo(22, 0);
                ctx.lineTo(26, 8);
                ctx.lineTo(22, 10);
                ctx.lineTo(14, 2);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#a0a0a0';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(22, -9);
                ctx.lineTo(25, 0);
                ctx.lineTo(22, 9);
                ctx.stroke();
                break;
                
            case 'staff':
                ctx.fillStyle = '#5a4030';
                ctx.fillRect(-10, -2, 32, 4);
                ctx.fillStyle = '#8b4513';
                ctx.beginPath();
                ctx.arc(24, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = classData?.color || '#9370db';
                ctx.beginPath();
                ctx.arc(24, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `rgba(200, 150, 255, ${0.3 + Math.sin(Date.now() / 200) * 0.2})`;
                ctx.beginPath();
                ctx.arc(24, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'wand':
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(-4, -1.5, 22, 3);
                ctx.fillStyle = classData?.color || '#9370db';
                ctx.beginPath();
                ctx.moveTo(18, 0);
                ctx.lineTo(22, -4);
                ctx.lineTo(26, 0);
                ctx.lineTo(22, 4);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = `rgba(200, 150, 255, ${0.4 + Math.sin(Date.now() / 150) * 0.3})`;
                ctx.beginPath();
                ctx.arc(22, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'bow':
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, -18);
                ctx.lineTo(8, 0);
                ctx.lineTo(0, 18);
                ctx.stroke();
                ctx.strokeStyle = '#5a4030';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, -18);
                ctx.quadraticCurveTo(-8, 0, 0, 18);
                ctx.stroke();
                if (!isAttacking) {
                    ctx.fillStyle = '#4a3a2a';
                    ctx.fillRect(6, -1, 16, 2);
                    ctx.fillStyle = '#808080';
                    ctx.beginPath();
                    ctx.moveTo(22, 0);
                    ctx.lineTo(18, -3);
                    ctx.lineTo(18, 3);
                    ctx.closePath();
                    ctx.fill();
                }
                break;
                
            case 'scythe':
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(-8, -2, 30, 4);
                ctx.fillStyle = '#606060';
                ctx.beginPath();
                ctx.moveTo(20, -2);
                ctx.quadraticCurveTo(30, -15, 18, -20);
                ctx.lineTo(16, -18);
                ctx.quadraticCurveTo(26, -12, 20, 2);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#a0a0a0';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(20, -3);
                ctx.quadraticCurveTo(29, -14, 18, -19);
                ctx.stroke();
                break;
                
            case 'dagger':
                ctx.fillStyle = '#c0c0c0';
                ctx.beginPath();
                ctx.moveTo(0, -1.5);
                ctx.lineTo(14, -2);
                ctx.lineTo(16, 0);
                ctx.lineTo(14, 2);
                ctx.lineTo(0, 1.5);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#4a3520';
                ctx.fillRect(-6, -2, 6, 4);
                break;
                
            case 'kunai':
                ctx.fillStyle = '#4a4a4a';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(16, -4);
                ctx.lineTo(20, 0);
                ctx.lineTo(16, 4);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#808080';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(2, 0);
                ctx.lineTo(18, -3);
                ctx.stroke();
                ctx.strokeStyle = '#3a3a3a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(-6, 0, 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = '#2a2020';
                ctx.fillRect(-3, -2, 4, 4);
                break;
                
            case 'lance':
            case 'magic_lance':
                ctx.fillStyle = '#4a3a2a';
                ctx.fillRect(-8, -2, 35, 4);
                ctx.fillStyle = '#808080';
                ctx.beginPath();
                ctx.moveTo(27, 0);
                ctx.lineTo(35, 0);
                ctx.lineTo(27, -5);
                ctx.moveTo(27, 0);
                ctx.lineTo(27, 5);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#5a5a5a';
                ctx.fillRect(24, -4, 3, 8);
                break;
                
            case 'hammer':
            case 'mace':
                ctx.fillStyle = '#5a4030';
                ctx.fillRect(-4, -2, 18, 4);
                ctx.fillStyle = '#606060';
                ctx.fillRect(12, -8, 10, 16);
                ctx.fillStyle = '#404040';
                ctx.beginPath();
                ctx.arc(17, -6, 2, 0, Math.PI * 2);
                ctx.arc(17, 6, 2, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'musket':
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(0, -2.5, 35, 5);
                ctx.fillStyle = '#c0a030';
                ctx.fillRect(8, -3, 3, 6);
                ctx.fillRect(20, -3, 3, 6);
                ctx.fillStyle = '#2a2a2a';
                ctx.beginPath();
                ctx.arc(35, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#6b4423';
                ctx.beginPath();
                ctx.moveTo(0, -3);
                ctx.lineTo(-8, -4);
                ctx.quadraticCurveTo(-14, -2, -16, 4);
                ctx.lineTo(-14, 8);
                ctx.lineTo(-6, 6);
                ctx.lineTo(0, 3);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'crossbow':
                ctx.fillStyle = '#404040';
                ctx.fillRect(0, -2, 28, 4);
                ctx.fillStyle = '#5a4030';
                ctx.beginPath();
                ctx.moveTo(0, -3);
                ctx.lineTo(-12, -5);
                ctx.lineTo(-12, 5);
                ctx.lineTo(0, 3);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#4a3a2a';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(20, -12);
                ctx.moveTo(20, 0);
                ctx.lineTo(20, 12);
                ctx.stroke();
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(20, -12);
                ctx.lineTo(8, 0);
                ctx.lineTo(20, 12);
                ctx.stroke();
                break;
                
            default:
                ctx.fillStyle = weaponColor;
                ctx.fillRect(0, -2, 18, 4);
                break;
        }
    }
    
    // Render boss room obstacles
    renderBossObstacles(ctx) {
        const time = Date.now() / 1000;
        
        for (const obstacle of this.bossObstacles) {
            if (obstacle.type === 'pillar') {
                // Render pillar
                const hw = obstacle.width / 2;
                const hh = obstacle.height / 2;
                
                // Shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.ellipse(obstacle.x, obstacle.y + hh + 4, hw + 4, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Pillar base
                ctx.fillStyle = '#4a4a4a';
                ctx.fillRect(obstacle.x - hw - 4, obstacle.y + hh - 8, obstacle.width + 8, 12);
                
                // Pillar body
                ctx.fillStyle = '#666';
                ctx.fillRect(obstacle.x - hw, obstacle.y - hh, obstacle.width, obstacle.height);
                
                // Pillar highlight
                ctx.fillStyle = '#888';
                ctx.fillRect(obstacle.x - hw + 4, obstacle.y - hh + 4, 6, obstacle.height - 8);
                
                // Pillar top
                ctx.fillStyle = '#555';
                ctx.fillRect(obstacle.x - hw - 4, obstacle.y - hh - 8, obstacle.width + 8, 10);
                
                // Damage cracks if destructible and damaged
                if (obstacle.destructible && obstacle.health < 100) {
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2;
                    const crackAmount = 1 - obstacle.health / 100;
                    for (let i = 0; i < Math.floor(crackAmount * 5); i++) {
                        ctx.beginPath();
                        const cx = obstacle.x - hw + Math.random() * obstacle.width;
                        const cy = obstacle.y - hh + Math.random() * obstacle.height;
                        ctx.moveTo(cx, cy);
                        ctx.lineTo(cx + (Math.random() - 0.5) * 15, cy + Math.random() * 10);
                        ctx.stroke();
                    }
                }
            } else if (obstacle.type === 'hazard') {
                // Render hazard based on type
                const pulse = 0.7 + Math.sin(time * 3 + obstacle.pulsePhase) * 0.3;
                const baseColor = obstacle.color;
                
                // Glow effect
                ctx.save();
                ctx.globalAlpha = 0.3 * pulse;
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.arc(obstacle.x, obstacle.y, obstacle.radius * 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                
                // Main hazard
                ctx.fillStyle = baseColor;
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(obstacle.x, obstacle.y, obstacle.radius * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                
                // Inner detail
                ctx.fillStyle = this.lightenColor(baseColor, 30);
                ctx.beginPath();
                ctx.arc(obstacle.x, obstacle.y, obstacle.radius * 0.6 * pulse, 0, Math.PI * 2);
                ctx.fill();
                
                // Animated particles
                for (let i = 0; i < 4; i++) {
                    const angle = (time * 2 + i * Math.PI / 2 + obstacle.pulsePhase) % (Math.PI * 2);
                    const dist = obstacle.radius * 0.8;
                    const px = obstacle.x + Math.cos(angle) * dist;
                    const py = obstacle.y + Math.sin(angle) * dist;
                    
                    ctx.fillStyle = baseColor;
                    ctx.globalAlpha = 0.6 + Math.sin(time * 4 + i) * 0.4;
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
        }
    }
    
    // Render ghost at equivalent position on other side of map
    renderWrapGhost(ctx) {
        const ghost = this.wrapGhost;
        const p = this.player;
        
        // Ghost alpha increases as timer progresses
        const alpha = Math.min(0.8, ghost.timer / ghost.delay);
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        const classData = ClassDefinitions[this.selectedClass];
        const baseColor = classData.color || '#4488ff';
        
        // Ethereal glow effect
        ctx.shadowColor = '#88ccff';
        ctx.shadowBlur = 15 + Math.sin(Date.now() / 100) * 5;
        
        // Draw ghost body at ghost position (mirrors player on other side)
        ctx.fillStyle = baseColor;
        ctx.fillRect(ghost.x - p.width/2, ghost.y - p.height/2, p.width, p.height);
        
        // Glowing outline
        ctx.strokeStyle = '#aaddff';
        ctx.lineWidth = 2;
        ctx.strokeRect(ghost.x - p.width/2, ghost.y - p.height/2, p.width, p.height);
        
        // Particles around ghost
        const particleCount = 6;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + Date.now() / 500;
            const dist = 12 + Math.sin(Date.now() / 200 + i) * 4;
            const px = ghost.x + Math.cos(angle) * dist;
            const py = ghost.y + Math.sin(angle) * dist;
            
            ctx.globalAlpha = alpha * 0.6;
            ctx.fillStyle = '#88ccff';
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    renderPlayer(ctx) {
        const p = this.player;
        const time = Date.now() / 1000;
        
        // Calculate animation values
        const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);
        const isMoving = speed > 10;
        const bobOffset = isMoving ? Math.sin(time * 12) * 3 : Math.sin(time * 2) * 1;
        let squashStretch = isMoving ? 1 + Math.sin(time * 12) * 0.1 : 1;
        
        // Dash stretch - elongate in direction of dash
        let dashStretchX = 1;
        let dashStretchY = 1;
        let dashRotation = 0;
        if (p.isDashing && p.dashDirX !== undefined && p.dashDirY !== undefined) {
            // Calculate stretch factor based on dash direction
            const dashStretchAmount = 1.6; // How much to stretch during dash
            const dashSquashAmount = 0.7; // How much to squash perpendicular to dash
            
            // Calculate the dash angle
            dashRotation = Math.atan2(p.dashDirY, p.dashDirX);
            
            // Apply stretch in dash direction, squash perpendicular
            dashStretchX = dashStretchAmount;
            dashStretchY = dashSquashAmount;
        }
        
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
        
        // Shadow - check for wall below to prevent overlap
        const shadowY = p.y + p.height/2 + 2;
        const tileBelow = this.dungeon ? this.dungeon.getTile(
            Math.floor(p.x / 32),
            Math.floor((shadowY + 8) / 32)
        ) : 1;
        
        // Only draw shadow if not overlapping a wall tile below
        if (tileBelow !== TILE_TYPES.WALL && tileBelow !== TILE_TYPES.VOID) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            const shadowScale = isMoving ? 0.9 + Math.sin(time * 12) * 0.1 : 1;
            ctx.ellipse(p.x, shadowY, p.width/2 * shadowScale, p.height/4, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Draw truncated shadow that stops at wall edge
            const wallTileY = Math.floor((shadowY + 8) / 32);
            const wallEdgeY = wallTileY * 32;
            const maxShadowY = Math.min(shadowY, wallEdgeY - 2);
            
            if (maxShadowY > p.y) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.beginPath();
                const shadowScale = isMoving ? 0.9 + Math.sin(time * 12) * 0.1 : 1;
                const truncatedHeight = Math.max(1, (maxShadowY - p.y) / (p.height/4 + 2));
                ctx.ellipse(p.x, p.y + p.height/2 + 1, p.width/2 * shadowScale * 0.8, truncatedHeight, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.save();
        ctx.translate(p.x, p.y + bobOffset);
        
        // Apply dash rotation and stretch
        if (p.isDashing && dashRotation !== 0) {
            ctx.rotate(dashRotation);
        }
        
        // Body with squash/stretch and dash stretch
        const classData = ClassDefinitions[this.selectedClass];
        const baseColor = classData.color || '#4488ff';
        
        // Draw body (animated) - apply dash stretch
        ctx.fillStyle = baseColor;
        const baseBodyW = p.width * (2 - squashStretch);
        const baseBodyH = p.height * squashStretch;
        const bodyW = baseBodyW * dashStretchX;
        const bodyH = baseBodyH * dashStretchY;
        
        // Rounded rectangle for stretched dash look
        if (p.isDashing) {
            // Draw elongated pill shape during dash
            ctx.beginPath();
            const radius = bodyH / 2;
            ctx.moveTo(-bodyW/2 + radius, -bodyH/2);
            ctx.lineTo(bodyW/2 - radius, -bodyH/2);
            ctx.arc(bodyW/2 - radius, 0, radius, -Math.PI/2, Math.PI/2);
            ctx.lineTo(-bodyW/2 + radius, bodyH/2);
            ctx.arc(-bodyW/2 + radius, 0, radius, Math.PI/2, -Math.PI/2);
            ctx.closePath();
            ctx.fill();
            
            // Dash glow effect
            ctx.shadowColor = '#88ccff';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#aaddff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillRect(-bodyW/2, -bodyH/2, bodyW, bodyH);
        }
        
        // Inner body detail (only when not dashing for clarity)
        if (!p.isDashing) {
            ctx.fillStyle = this.lightenColor(baseColor, 20);
            ctx.fillRect(-bodyW/2 + 4, -bodyH/2 + 4, bodyW - 8, bodyH/2 - 4);
        }
        
        // Eyes (follow mouse direction) - hide during dash for speed effect
        if (!p.isDashing) {
            const eyeOffsetX = p.facingX * 3;
            const eyeOffsetY = p.facingY * 2;
            ctx.fillStyle = '#fff';
            ctx.fillRect(-6 + eyeOffsetX, -4 + eyeOffsetY, 5, 5);
            ctx.fillRect(1 + eyeOffsetX, -4 + eyeOffsetY, 5, 5);
            ctx.fillStyle = '#000';
            ctx.fillRect(-5 + eyeOffsetX + p.facingX * 2, -3 + eyeOffsetY, 3, 3);
            ctx.fillRect(2 + eyeOffsetX + p.facingX * 2, -3 + eyeOffsetY, 3, 3);
        } else {
            // Speed lines during dash
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-bodyW/2 - 5, -2);
            ctx.lineTo(-bodyW/2 - 15, -2);
            ctx.moveTo(-bodyW/2 - 5, 2);
            ctx.lineTo(-bodyW/2 - 12, 2);
            ctx.stroke();
        }
        
        // Shield/Defense buff visual effect
        const hasShield = p.hasStatusEffect && (p.hasStatusEffect('defense_up') || p.hasStatusEffect('shield_active'));
        if (hasShield) {
            const shieldPulse = Math.sin(time * 4) * 0.15 + 0.85;
            const shieldRadius = Math.max(bodyW, bodyH) * 0.9 + 8;
            
            // Get shield hits remaining for visual intensity
            let shieldHits = 0;
            if (p.hasStatusEffect('shield_active') && p.statusEffects instanceof Map) {
                const shield = p.statusEffects.get('shield_active');
                shieldHits = shield ? shield.value : 0;
            }
            
            // Color based on shield type - spell shield is more purple/magical
            const isSpellShield = p.hasStatusEffect('shield_active');
            const baseColor = isSpellShield ? [180, 100, 255] : [100, 200, 255];
            
            // Outer glow
            ctx.save();
            ctx.shadowColor = isSpellShield ? '#aa66ff' : '#66ccff';
            ctx.shadowBlur = 20 * shieldPulse;
            
            // Shield bubble
            ctx.strokeStyle = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${0.6 * shieldPulse})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner glow ring
            ctx.strokeStyle = `rgba(${baseColor[0] + 50}, ${baseColor[1] + 20}, ${baseColor[2]}, ${0.4 * shieldPulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius - 4, 0, Math.PI * 2);
            ctx.stroke();
            
            // Hexagon overlay for magical feel
            ctx.strokeStyle = `rgba(${baseColor[0] + 70}, ${baseColor[1] + 40}, 255, ${0.3 * shieldPulse})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 + time * 0.5;
                const hx = Math.cos(angle) * shieldRadius * 0.8;
                const hy = Math.sin(angle) * shieldRadius * 0.8;
                if (i === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
            
            // Show remaining hits for spell shield
            if (isSpellShield && shieldHits > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * shieldPulse})`;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${shieldHits}`, 0, -shieldRadius - 5);
            }
            
            ctx.restore();
        }
        
        ctx.restore();
        
        // Render class-specific hat/prop (only when not dashing for clarity)
        if (!p.isDashing) {
            this.renderPlayerHat(ctx, p, classData, bobOffset);
        }
        
        // Weapon is now only rendered at cursor (renderWeaponCursor), not in hand
        
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
    
    // Render class-specific hats and props
    renderPlayerHat(ctx, p, classData, bobOffset) {
        const className = classData.name?.toLowerCase() || '';
        const time = Date.now() / 1000;
        const hw = p.width / 2;
        const hh = p.height / 2;
        
        ctx.save();
        ctx.translate(p.x, p.y - hh + bobOffset);
        
        switch(className) {
            case 'knight':
                // Knight helmet with visor
                ctx.fillStyle = '#666';
                ctx.fillRect(-hw + 2, -10, p.width - 4, 10);
                ctx.fillStyle = '#888';
                ctx.fillRect(-hw + 4, -8, p.width - 8, 5);
                // Visor slit
                ctx.fillStyle = '#222';
                ctx.fillRect(-hw + 6, -6, p.width - 12, 2);
                // Plume
                ctx.fillStyle = '#cc3333';
                ctx.fillRect(-2, -16, 4, 7);
                break;
                
            case 'viking':
                // Horned helmet
                ctx.fillStyle = '#8b7355';
                ctx.fillRect(-hw + 1, -8, p.width - 2, 9);
                // Horns
                ctx.fillStyle = '#f5deb3';
                ctx.beginPath();
                ctx.moveTo(-hw - 3, -5);
                ctx.lineTo(-hw + 4, -2);
                ctx.lineTo(-hw + 2, 2);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(hw + 3, -5);
                ctx.lineTo(hw - 4, -2);
                ctx.lineTo(hw - 2, 2);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'samurai':
                // Kabuto helmet
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(-hw + 1, -6, p.width - 2, 7);
                // Crest
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(-6, -4);
                ctx.lineTo(6, -4);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'assassin':
                // Hood
                ctx.fillStyle = '#2a2a2a';
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(-hw - 1, 3);
                ctx.lineTo(hw + 1, 3);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'ninja':
                // Ninja headband
                ctx.fillStyle = '#333';
                ctx.fillRect(-hw - 1, -5, p.width + 2, 6);
                // Metal plate
                ctx.fillStyle = '#888';
                ctx.fillRect(-4, -4, 8, 4);
                // Headband tails
                ctx.fillStyle = '#333';
                ctx.fillRect(hw, -4, 6, 2);
                break;
                
            case 'archer':
                // Feathered cap
                ctx.fillStyle = '#228b22';
                ctx.beginPath();
                ctx.moveTo(-hw + 2, -1);
                ctx.lineTo(0, -9);
                ctx.lineTo(hw - 2, -1);
                ctx.closePath();
                ctx.fill();
                // Feather
                ctx.fillStyle = '#ff6347';
                ctx.beginPath();
                ctx.moveTo(hw - 4, -3);
                ctx.lineTo(hw + 3, -12);
                ctx.lineTo(hw - 1, -4);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'musketeer':
                // Wide-brimmed hat
                ctx.fillStyle = '#4a3728';
                ctx.fillRect(-hw - 4, -5, p.width + 8, 5);
                ctx.fillRect(-hw + 2, -11, p.width - 4, 7);
                // Feather
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.moveTo(hw - 3, -9);
                ctx.quadraticCurveTo(hw + 5, -18, hw - 1, -5);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'mage':
                // Wizard hat
                ctx.fillStyle = '#4169e1';
                ctx.beginPath();
                ctx.moveTo(0, -20);
                ctx.lineTo(-hw - 2, -1);
                ctx.lineTo(hw + 2, -1);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#3a5fcd';
                ctx.fillRect(-hw - 3, -3, p.width + 6, 4);
                // Star
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(-1 + Math.sin(time) * 1, -11, 2, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'arcmage':
                // Grand wizard hat
                ctx.fillStyle = '#800080';
                ctx.beginPath();
                ctx.moveTo(0, -24);
                ctx.lineTo(-hw - 3, -1);
                ctx.lineTo(hw + 3, -1);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#9932cc';
                ctx.fillRect(-hw - 4, -3, p.width + 8, 4);
                // Glowing gem
                const gemGlow = 0.5 + Math.sin(time * 3) * 0.5;
                ctx.fillStyle = `rgba(0, 255, 255, ${gemGlow})`;
                ctx.beginPath();
                ctx.arc(0, -14, 3, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'darkmage':
                // Dark hood with horns
                ctx.fillStyle = '#1a0a1a';
                ctx.beginPath();
                ctx.moveTo(0, -14);
                ctx.lineTo(-hw - 1, 2);
                ctx.lineTo(hw + 1, 2);
                ctx.closePath();
                ctx.fill();
                // Small horns
                ctx.fillStyle = '#330033';
                ctx.beginPath();
                ctx.moveTo(-hw + 3, -8);
                ctx.lineTo(-hw - 1, -15);
                ctx.lineTo(-hw + 5, -5);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(hw - 3, -8);
                ctx.lineTo(hw + 1, -15);
                ctx.lineTo(hw - 5, -5);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'necromancer':
                // Skull crown
                ctx.fillStyle = '#f0f0f0';
                ctx.beginPath();
                ctx.arc(0, -7, 7, Math.PI, 0);
                ctx.fill();
                ctx.fillRect(-7, -7, 14, 5);
                // Eye sockets
                ctx.fillStyle = '#300';
                ctx.beginPath();
                ctx.arc(-3, -7, 2, 0, Math.PI * 2);
                ctx.arc(3, -7, 2, 0, Math.PI * 2);
                ctx.fill();
                // Glowing eyes
                const eyePulse = 0.3 + Math.sin(time * 4) * 0.7;
                ctx.fillStyle = `rgba(255, 0, 100, ${eyePulse})`;
                ctx.beginPath();
                ctx.arc(-3, -7, 1, 0, Math.PI * 2);
                ctx.arc(3, -7, 1, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'priest':
                // Holy halo
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                const haloGlow = 0.6 + Math.sin(time * 2) * 0.4;
                ctx.globalAlpha = haloGlow;
                ctx.beginPath();
                ctx.ellipse(0, -10, 10, 4, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                // Small cross
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(-1, -16, 2, 8);
                ctx.fillRect(-3, -13, 6, 2);
                break;
                
            case 'magical knight':
            case 'magicalknight':
                // Enchanted knight helmet
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(-hw + 2, -9, p.width - 4, 10);
                ctx.fillStyle = '#5a6578';
                ctx.fillRect(-hw + 4, -7, p.width - 8, 5);
                // Magic runes
                const runeGlow = 0.5 + Math.sin(time * 3) * 0.5;
                ctx.strokeStyle = `rgba(100, 200, 255, ${runeGlow})`;
                ctx.lineWidth = 1;
                ctx.strokeRect(-hw + 5, -6, p.width - 10, 4);
                // Enchanted plume
                ctx.fillStyle = `rgba(100, 200, 255, ${0.7 + Math.sin(time * 2) * 0.3})`;
                ctx.fillRect(-2, -15, 4, 7);
                break;
        }
        
        ctx.restore();
    }
    
    // Render equipped weapon in player's hand
    renderPlayerWeapon(ctx, p, bobOffset) {
        const weapon = p.equipment?.weapon;
        const classData = ClassDefinitions[this.selectedClass];
        
        // Calculate weapon position based on facing direction and attack state
        const weaponAngle = Math.atan2(p.facingY, p.facingX);
        const isAttacking = p.attackCooldown > 0;
        const swingPhase = isAttacking ? (p.attackCooldown / 0.5) * Math.PI : 0;
        
        ctx.save();
        ctx.translate(p.x, p.y + bobOffset);
        ctx.rotate(weaponAngle);
        
        // Offset from body - move weapon further from sprite for better visibility
        const handOffsetX = 24; // Increased from 16
        const handOffsetY = 12; // Increased from 8
        
        ctx.translate(handOffsetX, handOffsetY);
        
        // For ranged attack types, don't do melee swing animation
        const isRangedAttack = ['projectile', 'arrow', 'musketShot', 'boneSpear'].includes(classData.defaultAttackType);
        
        // Swing animation (only for melee weapons)
        if (isAttacking && !isRangedAttack) {
            ctx.rotate(-swingPhase + Math.PI / 4);
        }
        
        // Determine weapon type - prefer ranged weapon for ranged classes
        let weaponType = weapon?.type;
        if (!weaponType) {
            if (classData.defaultAttackType === 'musketShot') {
                weaponType = 'musket';
            } else if (classData.defaultAttackType === 'arrow') {
                weaponType = 'bow';
            } else {
                weaponType = classData.weaponTypes?.[0] || 'sword';
            }
        }
        const weaponColor = weapon?.color || '#aaaaaa';
        
        // Draw weapon based on type with improved aesthetics
        switch (weaponType) {
            case 'sword':
            case 'enchanted_sword':
                // Blade
                ctx.fillStyle = '#c0c0c0';
                ctx.beginPath();
                ctx.moveTo(0, -2);
                ctx.lineTo(22, -3);
                ctx.lineTo(25, 0);
                ctx.lineTo(22, 3);
                ctx.lineTo(0, 2);
                ctx.closePath();
                ctx.fill();
                // Edge highlight
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(2, -1);
                ctx.lineTo(22, -2);
                ctx.stroke();
                // Guard
                ctx.fillStyle = '#8b4513';
                ctx.fillRect(-2, -5, 4, 10);
                // Handle
                ctx.fillStyle = '#4a3520';
                ctx.fillRect(-8, -2, 6, 4);
                // Pommel
                ctx.fillStyle = weaponColor;
                ctx.beginPath();
                ctx.arc(-9, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'katana':
                // Curved blade
                ctx.strokeStyle = '#e8e8e8';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(15, -4, 28, -2);
                ctx.stroke();
                // Edge
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(2, -1);
                ctx.quadraticCurveTo(15, -5, 27, -3);
                ctx.stroke();
                // Tsuba (guard)
                ctx.fillStyle = '#2a2a2a';
                ctx.beginPath();
                ctx.ellipse(-1, 0, 4, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                // Handle (wrapped)
                ctx.fillStyle = '#1a1a2a';
                ctx.fillRect(-12, -2, 11, 4);
                for (let i = 0; i < 3; i++) {
                    ctx.fillStyle = '#daa520';
                    ctx.fillRect(-11 + i * 4, -2, 2, 4);
                }
                break;
                
            case 'axe':
            case 'runic_axe':
                // Handle
                ctx.fillStyle = '#5a4030';
                ctx.fillRect(-4, -2, 20, 4);
                // Axe head
                ctx.fillStyle = '#707070';
                ctx.beginPath();
                ctx.moveTo(14, -2);
                ctx.lineTo(22, -10);
                ctx.lineTo(26, -8);
                ctx.lineTo(22, 0);
                ctx.lineTo(26, 8);
                ctx.lineTo(22, 10);
                ctx.lineTo(14, 2);
                ctx.closePath();
                ctx.fill();
                // Edge
                ctx.strokeStyle = '#a0a0a0';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(22, -9);
                ctx.lineTo(25, 0);
                ctx.lineTo(22, 9);
                ctx.stroke();
                break;
                
            case 'staff':
                // Wooden shaft
                ctx.fillStyle = '#5a4030';
                ctx.fillRect(-10, -2, 32, 4);
                // Ornate top
                ctx.fillStyle = '#8b4513';
                ctx.beginPath();
                ctx.arc(24, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                // Magic crystal
                ctx.fillStyle = classData.color || '#9370db';
                ctx.beginPath();
                ctx.arc(24, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                // Glow
                ctx.fillStyle = `rgba(200, 150, 255, ${0.3 + Math.sin(Date.now() / 200) * 0.2})`;
                ctx.beginPath();
                ctx.arc(24, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'wand':
                // Shaft
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(-4, -1.5, 22, 3);
                // Tip crystal
                ctx.fillStyle = classData.color || '#9370db';
                ctx.beginPath();
                ctx.moveTo(18, 0);
                ctx.lineTo(22, -4);
                ctx.lineTo(26, 0);
                ctx.lineTo(22, 4);
                ctx.closePath();
                ctx.fill();
                // Glow
                ctx.fillStyle = `rgba(200, 150, 255, ${0.4 + Math.sin(Date.now() / 150) * 0.3})`;
                ctx.beginPath();
                ctx.arc(22, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'bow':
                // Bowstring
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, -18);
                ctx.lineTo(8, 0);
                ctx.lineTo(0, 18);
                ctx.stroke();
                // Bow body (curved)
                ctx.strokeStyle = '#5a4030';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, -18);
                ctx.quadraticCurveTo(-8, 0, 0, 18);
                ctx.stroke();
                // Arrow (if not attacking)
                if (!isAttacking) {
                    ctx.fillStyle = '#4a3a2a';
                    ctx.fillRect(6, -1, 16, 2);
                    ctx.fillStyle = '#808080';
                    ctx.beginPath();
                    ctx.moveTo(22, 0);
                    ctx.lineTo(18, -3);
                    ctx.lineTo(18, 3);
                    ctx.closePath();
                    ctx.fill();
                }
                break;
                
            case 'scythe':
                // Long handle
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(-8, -2, 30, 4);
                // Blade
                ctx.fillStyle = '#606060';
                ctx.beginPath();
                ctx.moveTo(20, -2);
                ctx.quadraticCurveTo(30, -15, 18, -20);
                ctx.lineTo(16, -18);
                ctx.quadraticCurveTo(26, -12, 20, 2);
                ctx.closePath();
                ctx.fill();
                // Edge
                ctx.strokeStyle = '#a0a0a0';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(20, -3);
                ctx.quadraticCurveTo(29, -14, 18, -19);
                ctx.stroke();
                break;
                
            case 'dagger':
                // Short blade
                ctx.fillStyle = '#c0c0c0';
                ctx.beginPath();
                ctx.moveTo(0, -1.5);
                ctx.lineTo(14, -2);
                ctx.lineTo(16, 0);
                ctx.lineTo(14, 2);
                ctx.lineTo(0, 1.5);
                ctx.closePath();
                ctx.fill();
                // Handle
                ctx.fillStyle = '#4a3520';
                ctx.fillRect(-6, -2, 6, 4);
                break;
                
            case 'kunai':
                // Kunai blade (leaf-shaped)
                ctx.fillStyle = '#4a4a4a';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(16, -4);
                ctx.lineTo(20, 0);
                ctx.lineTo(16, 4);
                ctx.closePath();
                ctx.fill();
                // Edge highlight
                ctx.strokeStyle = '#808080';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(2, 0);
                ctx.lineTo(18, -3);
                ctx.stroke();
                // Ring at end (for holding/throwing)
                ctx.strokeStyle = '#3a3a3a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(-6, 0, 5, 0, Math.PI * 2);
                ctx.stroke();
                // Handle wrap
                ctx.fillStyle = '#2a2020';
                ctx.fillRect(-3, -2, 4, 4);
                break;
                
            case 'lance':
            case 'magic_lance':
                // Long shaft
                ctx.fillStyle = '#4a3a2a';
                ctx.fillRect(-8, -2, 35, 4);
                // Spearhead
                ctx.fillStyle = '#808080';
                ctx.beginPath();
                ctx.moveTo(27, 0);
                ctx.lineTo(35, 0);
                ctx.lineTo(27, -5);
                ctx.moveTo(27, 0);
                ctx.lineTo(27, 5);
                ctx.closePath();
                ctx.fill();
                // Guard
                ctx.fillStyle = '#5a5a5a';
                ctx.fillRect(24, -4, 3, 8);
                break;
                
            case 'hammer':
            case 'mace':
                // Handle
                ctx.fillStyle = '#5a4030';
                ctx.fillRect(-4, -2, 18, 4);
                // Head
                ctx.fillStyle = '#606060';
                ctx.fillRect(12, -8, 10, 16);
                // Studs
                ctx.fillStyle = '#404040';
                ctx.beginPath();
                ctx.arc(17, -6, 2, 0, Math.PI * 2);
                ctx.arc(17, 6, 2, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'musket':
                // Long ornate musket barrel
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(0, -2.5, 35, 5);
                // Barrel bands
                ctx.fillStyle = '#c0a030';
                ctx.fillRect(8, -3, 3, 6);
                ctx.fillRect(20, -3, 3, 6);
                // Muzzle
                ctx.fillStyle = '#2a2a2a';
                ctx.beginPath();
                ctx.arc(35, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                // Wooden stock (curved)
                ctx.fillStyle = '#6b4423';
                ctx.beginPath();
                ctx.moveTo(0, -3);
                ctx.lineTo(-8, -4);
                ctx.quadraticCurveTo(-14, -2, -16, 4);
                ctx.lineTo(-14, 8);
                ctx.lineTo(-6, 6);
                ctx.lineTo(0, 3);
                ctx.closePath();
                ctx.fill();
                // Stock highlight
                ctx.fillStyle = '#8b5a2b';
                ctx.beginPath();
                ctx.moveTo(-2, -2);
                ctx.lineTo(-6, -3);
                ctx.quadraticCurveTo(-10, -1, -12, 3);
                ctx.lineTo(-10, 5);
                ctx.lineTo(-4, 4);
                ctx.closePath();
                ctx.fill();
                // Trigger and guard
                ctx.strokeStyle = '#c0a030';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(-4, 6, 4, 0, Math.PI);
                ctx.stroke();
                ctx.fillStyle = '#404040';
                ctx.fillRect(-5, 4, 2, 4);
                // Flintlock mechanism
                ctx.fillStyle = '#606060';
                ctx.fillRect(-3, -4, 6, 3);
                break;
                
            case 'crossbow':
                // Barrel
                ctx.fillStyle = '#404040';
                ctx.fillRect(0, -2, 28, 4);
                // Stock
                ctx.fillStyle = '#5a4030';
                ctx.beginPath();
                ctx.moveTo(0, -3);
                ctx.lineTo(-12, -5);
                ctx.lineTo(-12, 5);
                ctx.lineTo(0, 3);
                ctx.closePath();
                ctx.fill();
                // Crossbow arms
                ctx.strokeStyle = '#4a3a2a';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(20, -12);
                ctx.moveTo(20, 0);
                ctx.lineTo(20, 12);
                ctx.stroke();
                // String
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(20, -12);
                ctx.lineTo(8, 0);
                ctx.lineTo(20, 12);
                ctx.stroke();
                // Trigger guard
                ctx.strokeStyle = '#303030';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(-2, 6, 4, 0, Math.PI);
                ctx.stroke();
                break;
                
            default:
                // Default simple weapon
                ctx.fillStyle = weaponColor;
                ctx.fillRect(0, -2, 18, 4);
                break;
        }
        
        ctx.restore();
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
        
        // Render boss dash afterimages
        if (enemy.bossDashTrail && enemy.bossDashTrail.length > 0) {
            for (const trail of enemy.bossDashTrail) {
                ctx.save();
                ctx.globalAlpha = trail.alpha * 0.6;
                ctx.translate(trail.x, trail.y);
                
                // Crackling distortion effect
                const crackle = Math.sin(time * 50 + trail.x) * 3;
                ctx.fillStyle = trail.color;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 10 + Math.random() * 10;
                
                // Draw distorted afterimage
                ctx.fillRect(-enemy.width/2 + crackle, -enemy.height/2, enemy.width, enemy.height);
                
                // Crackling lightning lines
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1 + Math.random();
                ctx.beginPath();
                const startX = -enemy.width/2 + Math.random() * enemy.width;
                const startY = -enemy.height/2 + Math.random() * enemy.height;
                ctx.moveTo(startX, startY);
                for (let i = 0; i < 3; i++) {
                    ctx.lineTo(startX + (Math.random() - 0.5) * 30, startY + (Math.random() - 0.5) * 30);
                }
                ctx.stroke();
                
                ctx.restore();
            }
        }
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(enemy.x, enemy.y + enemy.height/2 + 2, enemy.width/2, enemy.height/4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.save();
        ctx.translate(enemy.x, enemy.y + bobOffset);
        
        // Boss-specific rendering based on theme/type
        if (enemy.isBoss) {
            this.renderBossSprite(ctx, enemy, time, isMoving);
        } else {
            this.renderMobSprite(ctx, enemy, time, isMoving);
        }
        
        ctx.restore();
        
        // Health bar (only for non-bosses - bosses use big HUD bar)
        if (!enemy.isBoss) {
            const healthPercent = enemy.health / enemy.maxHealth;
            const barWidth = 30;
            ctx.fillStyle = '#222';
            ctx.fillRect(enemy.x - barWidth/2 - 1, enemy.y - enemy.height/2 - 10 + bobOffset, barWidth + 2, 6);
            
            const healthColor = healthPercent > 0.5 ? '#ff4444' : 
                               healthPercent > 0.25 ? '#ff8800' : '#ff0000';
            ctx.fillStyle = healthColor;
            ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.height/2 - 9 + bobOffset, barWidth * healthPercent, 4);
        }
        
        // Damage flash effect
        if (enemy.invulnerabilityTime > 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#fff';
            ctx.fillRect(enemy.x - enemy.width/2, enemy.y - enemy.height/2 + bobOffset, enemy.width, enemy.height);
            ctx.globalAlpha = 1;
        }
    }
    
    renderBossSprite(ctx, enemy, time, isMoving) {
        const w = enemy.width;
        const h = enemy.height;
        const pulse = Math.sin(time * 3) * 0.1 + 1;
        
        // Boss glow effect
        ctx.shadowColor = enemy.color;
        ctx.shadowBlur = 15 + Math.sin(time * 3) * 5;
        
        // Detect theme from boss type name (use enemyType first for accuracy)
        const bossType = (enemy.enemyType || enemy.name || enemy.type || '').toLowerCase();
        
        if (bossType.includes('pharaoh') || bossType.includes('anubis') || bossType.includes('egypt')) {
            // EGYPTIAN PHARAOH BOSS
            // Headdress/Nemes
            ctx.fillStyle = '#d4af37'; // Gold
            ctx.beginPath();
            ctx.moveTo(-w/2 - 5, -h/2);
            ctx.lineTo(w/2 + 5, -h/2);
            ctx.lineTo(w/2 + 8, -h/2 - 15);
            ctx.lineTo(0, -h/2 - 25);
            ctx.lineTo(-w/2 - 8, -h/2 - 15);
            ctx.closePath();
            ctx.fill();
            
            // Striped headdress sides
            ctx.fillStyle = '#1a237e';
            ctx.fillRect(-w/2 - 8, -h/2, 4, h/2);
            ctx.fillRect(w/2 + 4, -h/2, 4, h/2);
            
            // Face
            ctx.fillStyle = '#8d6e63'; // Egyptian skin tone
            ctx.fillRect(-w/2 + 2, -h/2, w - 4, h * 0.7);
            
            // Body wrap
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(-w/2, h * 0.2, w, h * 0.3);
            ctx.fillStyle = '#d4af37';
            ctx.fillRect(-w/2, h * 0.25, w, 3);
            ctx.fillRect(-w/2, h * 0.4, w, 3);
            
            // Eye of Ra
            ctx.fillStyle = '#000';
            ctx.fillRect(-8, -h/4, 6, 3);
            ctx.fillRect(2, -h/4, 6, 3);
            ctx.fillStyle = '#ff0';
            ctx.fillRect(-7, -h/4, 4, 2);
            ctx.fillRect(3, -h/4, 4, 2);
            
            // Crook & Flail crossed (if attacking)
            if (enemy.state === 'attack') {
                ctx.strokeStyle = '#d4af37';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-w, 0);
                ctx.lineTo(w, -h/2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(w, 0);
                ctx.lineTo(-w, -h/2);
                ctx.stroke();
            }
            
        } else if (bossType.includes('hades') || bossType.includes('cerberus') || bossType.includes('demon')) {
            // HADES/UNDERWORLD BOSS
            // Flame crown
            for (let i = 0; i < 5; i++) {
                const fx = -w/2 + (w / 4) * i;
                const fh = 10 + Math.sin(time * 5 + i) * 5;
                ctx.fillStyle = `rgba(${150 + i * 20}, ${50 + i * 10}, 255, 0.8)`;
                ctx.beginPath();
                ctx.moveTo(fx, -h/2);
                ctx.lineTo(fx + 5, -h/2 - fh);
                ctx.lineTo(fx + 10, -h/2);
                ctx.closePath();
                ctx.fill();
            }
            
            // Dark body
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(-w/2, -h/2, w, h);
            
            // Glowing runes on body
            ctx.fillStyle = '#9c27b0';
            for (let i = 0; i < 3; i++) {
                const ry = -h/4 + i * 10;
                ctx.fillRect(-w/4, ry, 3, 6);
                ctx.fillRect(w/4 - 3, ry, 3, 6);
            }
            
            // Three eyes (Cerberus-like)
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(-8, -h/4, 4, 0, Math.PI * 2);
            ctx.arc(0, -h/4 - 3, 3, 0, Math.PI * 2);
            ctx.arc(8, -h/4, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Dark aura
            ctx.shadowColor = '#9c27b0';
            ctx.shadowBlur = 25;
            
        } else if (bossType.includes('jungle') || bossType.includes('aztec') || bossType.includes('serpent')) {
            // JUNGLE/AZTEC BOSS
            // Feathered headdress
            const featherColors = ['#f44336', '#4caf50', '#2196f3', '#ffeb3b', '#e91e63'];
            for (let i = 0; i < 7; i++) {
                const angle = -Math.PI/2 + (i - 3) * 0.25;
                const flen = 20 + Math.sin(time * 2 + i) * 3;
                ctx.strokeStyle = featherColors[i % featherColors.length];
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo((i - 3) * 4, -h/2);
                ctx.lineTo((i - 3) * 6 + Math.cos(angle) * flen, -h/2 + Math.sin(angle) * flen);
                ctx.stroke();
            }
            
            // Jade mask face
            ctx.fillStyle = '#00796b';
            ctx.fillRect(-w/2, -h/2, w, h * 0.6);
            
            // Gold ornaments
            ctx.fillStyle = '#ffc107';
            ctx.beginPath();
            ctx.arc(-w/4, -h/4, 5, 0, Math.PI * 2);
            ctx.arc(w/4, -h/4, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Serpent body
            ctx.fillStyle = '#2e7d32';
            ctx.fillRect(-w/2, h * 0.1, w, h * 0.4);
            ctx.fillStyle = '#1b5e20';
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(-w/2 + i * 10, h * 0.15, 4, h * 0.3);
            }
            
            // Glowing eyes
            ctx.fillStyle = '#ffeb3b';
            ctx.fillRect(-10, -h/4, 6, 4);
            ctx.fillRect(4, -h/4, 6, 4);
            
        } else if (bossType.includes('light') || bossType.includes('angel') || bossType.includes('divine')) {
            // LIGHT/ANGELIC BOSS
            // Halo
            ctx.strokeStyle = '#fff9c4';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, -h/2 - 12, 12 + Math.sin(time * 2) * 2, 0, Math.PI * 2);
            ctx.stroke();
            
            // Radiant body
            ctx.fillStyle = '#fff8e1';
            ctx.fillRect(-w/2, -h/2, w, h);
            
            // Wings
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.moveTo(-w/2, -h/4);
            ctx.quadraticCurveTo(-w - 10, -h/2, -w - 5, h/4);
            ctx.quadraticCurveTo(-w/2 - 5, 0, -w/2, -h/4);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(w/2, -h/4);
            ctx.quadraticCurveTo(w + 10, -h/2, w + 5, h/4);
            ctx.quadraticCurveTo(w/2 + 5, 0, w/2, -h/4);
            ctx.fill();
            
            // Serene face
            ctx.fillStyle = '#5c6bc0';
            ctx.fillRect(-8, -h/4, 4, 2);
            ctx.fillRect(4, -h/4, 4, 2);
            
            ctx.shadowColor = '#fff9c4';
            ctx.shadowBlur = 30;
            
        } else if (bossType.includes('cyber') || bossType.includes('mech') || bossType.includes('robot')) {
            // CYBER/MECHANICAL BOSS
            // Antenna
            ctx.strokeStyle = '#00bcd4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -h/2);
            ctx.lineTo(0, -h/2 - 15);
            ctx.stroke();
            ctx.fillStyle = '#f44336';
            ctx.beginPath();
            ctx.arc(0, -h/2 - 15, 3 + Math.sin(time * 5) * 1, 0, Math.PI * 2);
            ctx.fill();
            
            // Metal body
            ctx.fillStyle = '#37474f';
            ctx.fillRect(-w/2, -h/2, w, h);
            
            // Circuit patterns
            ctx.strokeStyle = '#00bcd4';
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(-w/2, -h/4 + i * 8);
                ctx.lineTo(-w/4, -h/4 + i * 8);
                ctx.lineTo(-w/4, -h/4 + i * 8 + 4);
                ctx.lineTo(w/4, -h/4 + i * 8 + 4);
                ctx.lineTo(w/4, -h/4 + i * 8);
                ctx.lineTo(w/2, -h/4 + i * 8);
                ctx.stroke();
            }
            
            // Visor eye
            ctx.fillStyle = '#f44336';
            ctx.fillRect(-w/3, -h/4, w * 0.66, 4);
            
            // Glitch effect
            if (Math.random() < 0.05) {
                ctx.fillStyle = '#00bcd4';
                ctx.fillRect(-w/2, -h/2 + Math.random() * h, w, 3);
            }
            
        } else if (bossType.includes('stone') || bossType.includes('golem') || bossType.includes('titan')) {
            // STONE/GOLEM BOSS
            // Craggy body
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(-w/2, -h/2, w, h);
            
            // Stone texture
            ctx.fillStyle = '#795548';
            ctx.fillRect(-w/3, -h/3, w * 0.3, h * 0.4);
            ctx.fillRect(w/6, -h/4, w * 0.2, h * 0.3);
            ctx.fillStyle = '#4e342e';
            ctx.fillRect(-w/4, h * 0.1, w * 0.25, h * 0.2);
            
            // Glowing cracks
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-w/3, -h/2);
            ctx.lineTo(-w/4, 0);
            ctx.lineTo(-w/2, h/3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(w/4, -h/3);
            ctx.lineTo(w/3, h/4);
            ctx.stroke();
            
            // Magma eyes
            ctx.fillStyle = '#ff5722';
            ctx.beginPath();
            ctx.arc(-8, -h/4, 5, 0, Math.PI * 2);
            ctx.arc(8, -h/4, 5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowColor = '#ff9800';
            ctx.shadowBlur = 10;
            
        } else {
            // DEFAULT BOSS (fallback)
            ctx.fillStyle = enemy.color;
            const squash = isMoving ? 1 + Math.sin(time * 10) * 0.05 : 1;
            ctx.fillRect(-w/2 * (2 - squash), -h/2 * squash, w * (2 - squash), h * squash);
            
            // Angry eyes
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-8, -h/4, 6, 6);
            ctx.fillRect(2, -h/4, 6, 6);
        }
        
        ctx.shadowBlur = 0;
    }
    
    renderMobSprite(ctx, enemy, time, isMoving) {
        const w = enemy.width;
        const h = enemy.height;
        
        // Basic mob body with squash/stretch
        ctx.fillStyle = enemy.color;
        const squash = isMoving ? 1 + Math.sin(time * 10) * 0.05 : 1;
        ctx.fillRect(-w/2 * (2 - squash), -h/2 * squash, w * (2 - squash), h * squash);
        
        // Face features based on state
        if (enemy.state === 'attack') {
            // Angry eyes
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-6, -4, 4, 4);
            ctx.fillRect(2, -4, 4, 4);
            // Open mouth
            ctx.fillStyle = '#400000';
            ctx.fillRect(-3, 3, 6, 3);
        } else if (enemy.state === 'chase') {
            // Alert eyes
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(-5, -3, 4, 4);
            ctx.fillRect(1, -3, 4, 4);
            ctx.fillStyle = '#000';
            const lookX = enemy.facing?.x || 0;
            ctx.fillRect(-4 + lookX * 2, -2, 2, 2);
            ctx.fillRect(2 + lookX * 2, -2, 2, 2);
        } else {
            // Idle eyes
            ctx.fillStyle = '#ff6666';
            ctx.fillRect(-5, -3, 3, 3);
            ctx.fillRect(2, -3, 3, 3);
        }
    }
    
    // Use a health potion (R key)
    useHealthPotion() {
        if (!this.player.potions) {
            this.player.potions = { health: 0, mana: 0 };
        }
        if (!this.player.potionCooldowns) {
            this.player.potionCooldowns = { health: 0, mana: 0 };
        }
        
        // Check cooldown
        if (this.player.potionCooldowns.health > 0) {
            return;
        }
        
        // Check if we have potions
        if (this.player.potions.health <= 0) {
            this.uiManager.addNotification('No health potions!', 'warning');
            return;
        }
        
        // Check if health is already full
        if (this.player.health >= this.player.maxHealth) {
            this.uiManager.addNotification('Health already full!', 'info');
            return;
        }
        
        // Use the potion
        this.player.potions.health--;
        const healAmount = Math.floor(this.player.maxHealth * 0.35);
        this.player.health = Math.min(this.player.health + healAmount, this.player.maxHealth);
        this.player.potionCooldowns.health = 1.0;
        
        this.uiManager.addNotification(`+${healAmount} HP`, 'heal');
        this.soundManager.playHeal();
    }
    
    // Use a mana potion (F key)
    useManaPotion() {
        if (!this.player.potions) {
            this.player.potions = { health: 0, mana: 0 };
        }
        if (!this.player.potionCooldowns) {
            this.player.potionCooldowns = { health: 0, mana: 0 };
        }
        
        // Check cooldown
        if (this.player.potionCooldowns.mana > 0) {
            return;
        }
        
        // Check if we have potions
        if (this.player.potions.mana <= 0) {
            this.uiManager.addNotification('No mana potions!', 'warning');
            return;
        }
        
        // Check if mana is already full
        if (this.player.mana >= this.player.maxMana) {
            this.uiManager.addNotification('Mana already full!', 'info');
            return;
        }
        
        // Use the potion
        this.player.potions.mana--;
        const manaAmount = Math.floor(this.player.maxMana * 0.35);
        this.player.mana = Math.min(this.player.mana + manaAmount, this.player.maxMana);
        this.player.potionCooldowns.mana = 1.0;
        
        this.uiManager.addNotification(`+${manaAmount} MP`, 'mana');
        this.soundManager.playHeal();
    }
}

// Market Scene - Shopping floor between combat floors
class MarketScene extends Scene {
    constructor(engine, player, currentFloor, floorTheme) {
        super();
        this.engine = engine;
        this.player = player;
        this.currentFloor = currentFloor;
        this.floorTheme = floorTheme;
        
        // Sound manager
        this.soundManager = new SoundManager();
        
        // Create market layout themed after previous floor
        this.marketLayout = new MarketLayout(floorTheme);
        
        // Create market UI
        this.marketUI = new MarketUI(engine.canvas, this.player, this.marketLayout, this.soundManager);
        
        // Market dimensions (tile-based)
        this.tileSize = 32;
        this.marketWidth = 40;
        this.marketHeight = 30;
        
        // Player position in market (starts at entrance)
        this.player.x = this.marketWidth * this.tileSize / 2;
        this.player.y = (this.marketHeight - 3) * this.tileSize;
        
        // Mercenary companion (if any)
        this.mercenary = player.mercenary || null;
        if (this.mercenary) {
            this.mercenary.x = this.player.x + 40;
            this.mercenary.y = this.player.y;
        }
        
        // NPCs in the market
        this.npcs = [];
        this.generateNPCs();
        
        // Active dialogue/interaction
        this.activeInteraction = null;
        this.interactionPrompt = null;
        
        // Exit zone (to proceed to next combat floor)
        this.exitZone = {
            x: (this.marketWidth / 2 - 2) * this.tileSize,
            y: 2 * this.tileSize,
            width: 4 * this.tileSize,
            height: 2 * this.tileSize
        };
        
        // Camera
        this.camera = engine.camera;
        this.camera.x = this.player.x - engine.canvas.width / 2;
        this.camera.y = this.player.y - engine.canvas.height / 2;
        
        // Movement
        this.moveDirection = { x: 0, y: 0 };
        
        // Transition state (leaving market)
        this.transitioning = false;
        this.transitionTimer = 0;
        
        // Heal player and restore potions on market entry
        this.restorePlayerOnEntry();
        
        // UI Manager for notifications
        this.uiManager = new UIManager(engine.ctx, engine.canvas);
        
        // Notification
        this.uiManager.addNotification(`Welcome to the ${this.getMarketName()}!`, 'legendary');
    }
    
    getMarketName() {
        const names = {
            egypt: 'Bazaar of the Sands',
            hades: 'Underworld Market',
            jungle: 'Jungle Trading Post',
            light: 'Celestial Marketplace',
            cyber: 'Neon Emporium',
            stone: 'Mountain Trading Hall'
        };
        return names[this.floorTheme] || 'Market';
    }
    
    restorePlayerOnEntry() {
        // Full health restore
        this.player.health = this.player.maxHealth;
        
        // Full mana restore
        this.player.mana = this.player.maxMana;
        
        // Restore potions (give 3 of each if less)
        if (!this.player.potions) {
            this.player.potions = { health: 3, mana: 3 };
        } else {
            this.player.potions.health = Math.max(this.player.potions.health, 3);
            this.player.potions.mana = Math.max(this.player.potions.mana, 3);
        }
        
        this.soundManager.playHeal();
    }
    
    generateNPCs() {
        // Get building positions and create NPCs for each
        const buildings = this.marketLayout.buildings;
        
        for (const building of buildings) {
            // Each building has an NPC attendant
            const npc = new MarketNPC(
                building.type === BUILDING_TYPES.FORTUNE_TELLER ? NPC_TYPES.FORTUNE_TELLER :
                building.type === BUILDING_TYPES.ARENA ? NPC_TYPES.ARENA_MASTER :
                building.type === BUILDING_TYPES.GUILD ? NPC_TYPES.GUILD_MASTER :
                building.type === BUILDING_TYPES.MERCENARY_CAMP ? NPC_TYPES.MERCENARY :
                building.type === BUILDING_TYPES.CLASS_HALL ? NPC_TYPES.CLASS_TRAINER :
                NPC_TYPES.MERCHANT,
                building.gridX * this.tileSize + this.tileSize * 2,
                building.gridY * this.tileSize + this.tileSize * 2,
                building
            );
            npc.isFemale = Math.random() > 0.5;
            this.npcs.push(npc);
        }
        
        // Add wandering NPCs
        for (let i = 0; i < 8; i++) {
            const x = randomInt(5, this.marketWidth - 5) * this.tileSize;
            const y = randomInt(5, this.marketHeight - 5) * this.tileSize;
            const npc = new MarketNPC(
                Math.random() > 0.7 ? NPC_TYPES.GUARD : NPC_TYPES.WANDERER,
                x, y, null
            );
            npc.isFemale = Math.random() > 0.5;
            npc.isWanderer = true;
            this.npcs.push(npc);
        }
    }
    
    update(dt) {
        // Handle transitioning to next floor
        if (this.transitioning) {
            this.transitionTimer += dt;
            if (this.transitionTimer >= 1.5) {
                return 'exitMarket';
            }
            return GameState.MARKET;
        }
        
        // Handle active UI panels
        if (this.marketUI.hasActivePanel()) {
            // Check for escape to close
            if (this.engine.wasKeyJustPressed('Escape')) {
                this.marketUI.closeAllPanels();
            }
            
            // Handle clicks in panels
            if (this.engine.wasMouseJustPressed(0)) {
                const mouse = this.engine.getMousePosition();
                this.marketUI.handleClick(mouse.x, mouse.y);
            }
            
            return GameState.MARKET;
        }
        
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
        
        // Move player
        const speed = 200; // Market walk speed
        const newX = this.player.x + this.moveDirection.x * speed * dt;
        const newY = this.player.y + this.moveDirection.y * speed * dt;
        
        // Keep player in bounds
        this.player.x = clamp(newX, this.tileSize, (this.marketWidth - 1) * this.tileSize);
        this.player.y = clamp(newY, this.tileSize, (this.marketHeight - 1) * this.tileSize);
        
        // Update mercenary position
        if (this.mercenary) {
            const targetX = this.player.x + 40;
            const targetY = this.player.y;
            const dx = targetX - this.mercenary.x;
            const dy = targetY - this.mercenary.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 5) {
                this.mercenary.x += (dx / dist) * speed * 0.8 * dt;
                this.mercenary.y += (dy / dist) * speed * 0.8 * dt;
            }
            
            // Mercenary periodic dialogue
            if (!this.mercenary.dialogueTimer) this.mercenary.dialogueTimer = 0;
            this.mercenary.dialogueTimer += dt;
            if (this.mercenary.dialogueTimer > 8 + Math.random() * 5) {
                this.mercenary.dialogueTimer = 0;
                this.mercenary.speak();
            }
        }
        
        // Update wandering NPCs
        for (const npc of this.npcs) {
            if (npc.isWanderer) {
                npc.updateWander(dt, 0, 0, this.marketWidth * this.tileSize, this.marketHeight * this.tileSize);
            }
        }
        
        // Check for NPC interactions
        this.interactionPrompt = null;
        let nearestNPC = null;
        let nearestDist = 60; // Interaction range
        
        for (const npc of this.npcs) {
            const dx = npc.x - this.player.x;
            const dy = npc.y - this.player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestNPC = npc;
            }
        }
        
        if (nearestNPC) {
            this.interactionPrompt = {
                text: `Press E to ${this.getInteractionText(nearestNPC)}`,
                npc: nearestNPC
            };
            
            if (this.engine.wasKeyJustPressed('KeyE')) {
                this.interactWithNPC(nearestNPC);
            }
        }
        
        // Check exit zone
        if (this.player.x >= this.exitZone.x && 
            this.player.x <= this.exitZone.x + this.exitZone.width &&
            this.player.y >= this.exitZone.y && 
            this.player.y <= this.exitZone.y + this.exitZone.height) {
            
            if (!this.interactionPrompt) {
                this.interactionPrompt = {
                    text: 'Press E to descend to next floor',
                    npc: null
                };
            }
            
            if (this.engine.wasKeyJustPressed('KeyE') && !nearestNPC) {
                this.transitioning = true;
                this.uiManager.addNotification('Descending...', 'legendary');
            }
        }
        
        // Update camera
        this.camera.x = this.player.x - this.engine.canvas.width / 2;
        this.camera.y = this.player.y - this.engine.canvas.height / 2;
        
        // Clamp camera to market bounds
        this.camera.x = clamp(this.camera.x, 0, this.marketWidth * this.tileSize - this.engine.canvas.width);
        this.camera.y = clamp(this.camera.y, 0, this.marketHeight * this.tileSize - this.engine.canvas.height);
        
        // Update notifications
        this.uiManager.update(dt);
        
        return GameState.MARKET;
    }
    
    getInteractionText(npc) {
        switch (npc.type) {
            case NPC_TYPES.MERCHANT: return 'Shop';
            case NPC_TYPES.FORTUNE_TELLER: return 'Get Reading';
            case NPC_TYPES.ARENA_MASTER: return 'Enter Arena';
            case NPC_TYPES.GUILD_MASTER: return 'View Quests';
            case NPC_TYPES.MERCENARY: return 'Hire Mercenary';
            case NPC_TYPES.CLASS_TRAINER: return 'Get Advice';
            case NPC_TYPES.GUARD: return 'Talk';
            case NPC_TYPES.WANDERER: return 'Talk';
            default: return 'Interact';
        }
    }
    
    interactWithNPC(npc) {
        // Play NPC sound
        this.soundManager.playNPCInteract(npc.isFemale);
        
        switch (npc.type) {
            case NPC_TYPES.MERCHANT:
                this.marketUI.openShop(npc.building);
                break;
            case NPC_TYPES.FORTUNE_TELLER:
                this.marketUI.openFortuneTeller(this.currentFloor);
                break;
            case NPC_TYPES.ARENA_MASTER:
                this.marketUI.openArenaPanel();
                break;
            case NPC_TYPES.GUILD_MASTER:
                this.marketUI.openGuildPanel();
                break;
            case NPC_TYPES.MERCENARY:
                if (!this.mercenary) {
                    this.marketUI.openMercenaryPanel((merc) => this.hireMercenary(merc));
                } else {
                    this.uiManager.addNotification('You already have a mercenary!', 'warning');
                }
                break;
            case NPC_TYPES.CLASS_TRAINER:
                this.showClassAdvice(npc);
                break;
            case NPC_TYPES.GUARD:
            case NPC_TYPES.WANDERER:
                this.showRandomDialogue(npc);
                break;
        }
    }
    
    hireMercenary(mercenary) {
        if (this.player.gold >= mercenary.hireCost) {
            this.player.gold -= mercenary.hireCost;
            this.mercenary = mercenary;
            this.player.mercenary = mercenary;
            this.mercenary.x = this.player.x + 40;
            this.mercenary.y = this.player.y;
            this.uiManager.addNotification(`${mercenary.name} has joined you!`, 'legendary');
            this.soundManager.playCoin();
        } else {
            this.uiManager.addNotification('Not enough gold!', 'warning');
        }
    }
    
    showClassAdvice(npc) {
        const advice = this.getClassAdvice();
        this.uiManager.addNotification(advice, 'info');
    }
    
    getClassAdvice() {
        const adviceList = [
            "Remember to use your abilities wisely!",
            "Potions can save your life in tough fights.",
            "Explore every room for hidden treasures.",
            "Bosses have patterns - learn them!",
            "Upgrading your weapon is crucial for progress.",
            "Don't forget to level up your skills!",
            "Some enemies are weak to certain damage types.",
            "Dodge rolling can avoid most attacks."
        ];
        return adviceList[Math.floor(Math.random() * adviceList.length)];
    }
    
    showRandomDialogue(npc) {
        const dialogues = [
            "The dungeon grows more dangerous below...",
            "I've heard strange sounds from the depths.",
            "Be careful, adventurer. Many don't return.",
            "The market has the best deals around!",
            "Have you visited the fortune teller?",
            "The arena champions are legendary fighters.",
            "A good mercenary is worth their weight in gold.",
            "May fortune favor your journey!"
        ];
        const dialogue = dialogues[Math.floor(Math.random() * dialogues.length)];
        this.uiManager.addNotification(`"${dialogue}"`, 'info');
    }
    
    render(ctx) {
        // Clear canvas
        ctx.fillStyle = this.getMarketBackgroundColor();
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Save context and apply camera transform
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw market floor
        this.renderMarketFloor(ctx);
        
        // Draw buildings
        this.renderBuildings(ctx);
        
        // Draw exit zone
        this.renderExitZone(ctx);
        
        // Draw NPCs
        for (const npc of this.npcs) {
            this.renderNPC(ctx, npc);
        }
        
        // Draw mercenary
        if (this.mercenary) {
            this.renderMercenary(ctx);
        }
        
        // Draw player
        this.renderPlayer(ctx);
        
        // Restore context
        ctx.restore();
        
        // Draw UI elements (screen space)
        this.renderUI(ctx);
        
        // Draw market UI panels
        this.marketUI.render(ctx);
        
        // Draw transition overlay
        if (this.transitioning) {
            const alpha = this.transitionTimer / 1.5;
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        
        // Draw notifications
        this.uiManager.renderNotifications(ctx);
    }
    
    getMarketBackgroundColor() {
        const colors = {
            egypt: '#1a1508',
            hades: '#1a0808',
            jungle: '#081a08',
            light: '#18181a',
            cyber: '#080818',
            stone: '#121212'
        };
        return colors[this.floorTheme] || '#1a1a2e';
    }
    
    renderMarketFloor(ctx) {
        const theme = FLOOR_THEMES[this.floorTheme];
        const floorColor = theme ? theme.colors.floor : '#3a3a3a';
        const accentColor = theme ? theme.colors.accent : '#ffd700';
        
        // Draw floor tiles
        for (let y = 0; y < this.marketHeight; y++) {
            for (let x = 0; x < this.marketWidth; x++) {
                const tileX = x * this.tileSize;
                const tileY = y * this.tileSize;
                
                // Checkered pattern
                const isLight = (x + y) % 2 === 0;
                ctx.fillStyle = isLight ? floorColor : this.darkenColor(floorColor, 0.15);
                ctx.fillRect(tileX, tileY, this.tileSize, this.tileSize);
                
                // Occasional decorative tiles
                if (Math.random() < 0.02) {
                    ctx.fillStyle = accentColor + '33';
                    ctx.fillRect(tileX + 4, tileY + 4, this.tileSize - 8, this.tileSize - 8);
                }
            }
        }
        
        // Draw walls around perimeter
        const wallColor = theme ? theme.colors.wall : '#555';
        ctx.fillStyle = wallColor;
        
        // Top wall (except exit)
        ctx.fillRect(0, 0, this.exitZone.x, this.tileSize * 2);
        ctx.fillRect(this.exitZone.x + this.exitZone.width, 0, 
                     this.marketWidth * this.tileSize - this.exitZone.x - this.exitZone.width, this.tileSize * 2);
        
        // Bottom, left, right walls
        ctx.fillRect(0, (this.marketHeight - 2) * this.tileSize, this.marketWidth * this.tileSize, this.tileSize * 2);
        ctx.fillRect(0, 0, this.tileSize * 2, this.marketHeight * this.tileSize);
        ctx.fillRect((this.marketWidth - 2) * this.tileSize, 0, this.tileSize * 2, this.marketHeight * this.tileSize);
    }
    
    darkenColor(hex, factor) {
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        return `rgb(${Math.floor(r*(1-factor))}, ${Math.floor(g*(1-factor))}, ${Math.floor(b*(1-factor))})`;
    }
    
    renderBuildings(ctx) {
        const theme = FLOOR_THEMES[this.floorTheme];
        
        for (const building of this.marketLayout.buildings) {
            const x = building.gridX * this.tileSize;
            const y = building.gridY * this.tileSize;
            const w = building.width * this.tileSize;
            const h = building.height * this.tileSize;
            
            // Building base
            const buildingColor = theme ? theme.colors.wall : '#555';
            ctx.fillStyle = buildingColor;
            ctx.fillRect(x, y, w, h);
            
            // Building roof
            ctx.fillStyle = this.getBuildingRoofColor(building.type);
            ctx.fillRect(x + 4, y + 4, w - 8, 20);
            
            // Building sign
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.getBuildingName(building.type), x + w/2, y + 18);
            ctx.textAlign = 'left';
            
            // Entrance
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(x + w/2 - 15, y + h - 25, 30, 25);
        }
    }
    
    getBuildingRoofColor(type) {
        const colors = {
            [BUILDING_TYPES.WEAPON_SHOP]: '#8b0000',
            [BUILDING_TYPES.ARMOR_SHOP]: '#4682b4',
            [BUILDING_TYPES.POTION_SHOP]: '#228b22',
            [BUILDING_TYPES.GENERAL_STORE]: '#8b4513',
            [BUILDING_TYPES.FORTUNE_TELLER]: '#9400d3',
            [BUILDING_TYPES.ARENA]: '#ff4500',
            [BUILDING_TYPES.GUILD]: '#daa520',
            [BUILDING_TYPES.MERCENARY_CAMP]: '#2f4f4f',
            [BUILDING_TYPES.CLASS_HALL]: '#4169e1',
            [BUILDING_TYPES.INN]: '#cd853f'
        };
        return colors[type] || '#555';
    }
    
    getBuildingName(type) {
        const names = {
            [BUILDING_TYPES.WEAPON_SHOP]: '⚔️ Weapons',
            [BUILDING_TYPES.ARMOR_SHOP]: '🛡️ Armor',
            [BUILDING_TYPES.POTION_SHOP]: '🧪 Potions',
            [BUILDING_TYPES.GENERAL_STORE]: '📦 General',
            [BUILDING_TYPES.FORTUNE_TELLER]: '🔮 Fortune',
            [BUILDING_TYPES.ARENA]: '⚔️ Arena',
            [BUILDING_TYPES.GUILD]: '📜 Guild',
            [BUILDING_TYPES.MERCENARY_CAMP]: '🗡️ Mercenaries',
            [BUILDING_TYPES.CLASS_HALL]: '📚 Class Hall',
            [BUILDING_TYPES.INN]: '🏨 Inn'
        };
        return names[type] || 'Building';
    }
    
    renderExitZone(ctx) {
        // Draw exit portal/stairs
        const x = this.exitZone.x;
        const y = this.exitZone.y;
        const w = this.exitZone.width;
        const h = this.exitZone.height;
        
        // Glowing portal effect
        const gradient = ctx.createRadialGradient(
            x + w/2, y + h/2, 0,
            x + w/2, y + h/2, w/2
        );
        gradient.addColorStop(0, '#4444ff');
        gradient.addColorStop(0.5, '#2222aa');
        gradient.addColorStop(1, '#111155');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('↓ Descend ↓', x + w/2, y + h/2 + 5);
        ctx.textAlign = 'left';
    }
    
    renderNPC(ctx, npc) {
        // NPC body
        const color = this.getNPCColor(npc.type);
        ctx.fillStyle = color;
        ctx.fillRect(npc.x - 12, npc.y - 16, 24, 32);
        
        // NPC head
        ctx.fillStyle = npc.isFemale ? '#ffdbac' : '#d4a574';
        ctx.beginPath();
        ctx.arc(npc.x, npc.y - 20, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // NPC type indicator
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.getNPCIcon(npc.type), npc.x, npc.y - 30);
        ctx.textAlign = 'left';
    }
    
    getNPCColor(type) {
        const colors = {
            [NPC_TYPES.MERCHANT]: '#8b4513',
            [NPC_TYPES.FORTUNE_TELLER]: '#9400d3',
            [NPC_TYPES.ARENA_MASTER]: '#ff4500',
            [NPC_TYPES.GUILD_MASTER]: '#daa520',
            [NPC_TYPES.MERCENARY]: '#2f4f4f',
            [NPC_TYPES.CLASS_TRAINER]: '#4169e1',
            [NPC_TYPES.GUARD]: '#708090',
            [NPC_TYPES.WANDERER]: '#696969'
        };
        return colors[type] || '#555';
    }
    
    getNPCIcon(type) {
        const icons = {
            [NPC_TYPES.MERCHANT]: '💰',
            [NPC_TYPES.FORTUNE_TELLER]: '🔮',
            [NPC_TYPES.ARENA_MASTER]: '⚔️',
            [NPC_TYPES.GUILD_MASTER]: '📜',
            [NPC_TYPES.MERCENARY]: '🗡️',
            [NPC_TYPES.CLASS_TRAINER]: '📚',
            [NPC_TYPES.GUARD]: '🛡️',
            [NPC_TYPES.WANDERER]: '👤'
        };
        return icons[type] || '❓';
    }
    
    renderMercenary(ctx) {
        // Mercenary body
        ctx.fillStyle = '#4a90d9';
        ctx.fillRect(this.mercenary.x - 12, this.mercenary.y - 16, 24, 32);
        
        // Mercenary head
        ctx.fillStyle = '#d4a574';
        ctx.beginPath();
        ctx.arc(this.mercenary.x, this.mercenary.y - 20, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Name tag
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.mercenary.name, this.mercenary.x, this.mercenary.y - 35);
        ctx.textAlign = 'left';
        
        // Health bar
        const healthPercent = this.mercenary.health / this.mercenary.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.mercenary.x - 15, this.mercenary.y + 18, 30, 4);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(this.mercenary.x - 15, this.mercenary.y + 18, 30 * healthPercent, 4);
    }
    
    renderPlayer(ctx) {
        // Player body
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(this.player.x - 12, this.player.y - 16, 24, 32);
        
        // Player head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y - 20, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Player indicator
        ctx.fillStyle = '#ffd700';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('▼', this.player.x, this.player.y - 40);
        ctx.textAlign = 'left';
    }
    
    renderUI(ctx) {
        // Interaction prompt
        if (this.interactionPrompt) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(ctx.canvas.width / 2 - 120, ctx.canvas.height - 60, 240, 40);
            
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.interactionPrompt.text, ctx.canvas.width / 2, ctx.canvas.height - 35);
            ctx.textAlign = 'left';
        }
        
        // Gold display
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 120, 30);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`💰 ${this.player.gold || 0}`, 20, 32);
        
        // Floor indicator
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 50, 150, 25);
        ctx.fillStyle = '#aaa';
        ctx.font = '14px Arial';
        ctx.fillText(`Next: Floor ${this.currentFloor + 1}`, 20, 68);
        
        // Player stats mini-display
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(ctx.canvas.width - 160, 10, 150, 60);
        
        // Health
        ctx.fillStyle = '#ff4444';
        ctx.fillText(`❤️ ${Math.floor(this.player.health)}/${this.player.maxHealth}`, ctx.canvas.width - 150, 30);
        
        // Mana
        ctx.fillStyle = '#4444ff';
        ctx.fillText(`💧 ${Math.floor(this.player.mana)}/${this.player.maxMana}`, ctx.canvas.width - 150, 50);
        
        // Potions
        const hp = this.player.potions?.health || 0;
        const mp = this.player.potions?.mana || 0;
        ctx.fillStyle = '#aaa';
        ctx.fillText(`🧪 HP:${hp} MP:${mp}`, ctx.canvas.width - 150, 65);
    }
}

// Death Screen Scene - Dark Souls inspired
class DeathScene extends Scene {
    constructor(engine, floor, level) {
        super();
        this.engine = engine;
        this.floor = floor;
        this.level = level;
        
        // Fade-in animation state
        this.fadeProgress = 0;
        this.fadeInDuration = 2.0; // 2 seconds to fade in
        this.textFadeDelay = 1.5; // Delay before "YOU DIED" starts appearing
        this.textFadeProgress = 0;
        this.textFadeDuration = 1.5; // 1.5 seconds for text to fade in
        this.statsDelay = 3.5; // Delay before stats appear
        this.statsProgress = 0;
        this.statsFadeDuration = 1.0;
        this.restartDelay = 4.5; // Delay before showing restart prompt
        this.restartProgress = 0;
        this.restartFadeDuration = 0.5;
        this.totalTime = 0;
        
        // Pulse effect for "YOU DIED"
        this.pulseTime = 0;
        
        // Blood drip particles
        this.bloodDrops = [];
        for (let i = 0; i < 5; i++) {
            this.bloodDrops.push({
                x: Math.random() * engine.canvas.width,
                y: -Math.random() * 100,
                speed: 30 + Math.random() * 50,
                size: 2 + Math.random() * 4,
                delay: Math.random() * 3
            });
        }
        
        // Can restart flag
        this.canRestart = false;
    }
    
    update(dt) {
        this.totalTime += dt;
        
        // Update fade progress
        if (this.fadeProgress < 1) {
            this.fadeProgress = Math.min(1, this.fadeProgress + dt / this.fadeInDuration);
        }
        
        // Update text fade (after delay)
        if (this.totalTime > this.textFadeDelay && this.textFadeProgress < 1) {
            this.textFadeProgress = Math.min(1, this.textFadeProgress + dt / this.textFadeDuration);
        }
        
        // Update stats fade (after delay)
        if (this.totalTime > this.statsDelay && this.statsProgress < 1) {
            this.statsProgress = Math.min(1, this.statsProgress + dt / this.statsFadeDuration);
        }
        
        // Update restart prompt fade (after delay)
        if (this.totalTime > this.restartDelay && this.restartProgress < 1) {
            this.restartProgress = Math.min(1, this.restartProgress + dt / this.restartFadeDuration);
            if (this.restartProgress >= 1) {
                this.canRestart = true;
            }
        }
        
        // Pulse effect
        this.pulseTime += dt;
        
        // Update blood drops
        for (const drop of this.bloodDrops) {
            if (this.totalTime > drop.delay) {
                drop.y += drop.speed * dt;
                if (drop.y > this.engine.canvas.height + 20) {
                    drop.y = -20;
                    drop.x = Math.random() * this.engine.canvas.width;
                }
            }
        }
        
        // Only allow restart after delay
        if (this.canRestart && this.engine.wasKeyJustPressed('Space')) {
            return 'restart';
        }
        return GameState.DEAD;
    }
    
    render(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        
        // Dark background with fade-in
        const bgAlpha = 0.95 * this.fadeProgress;
        ctx.fillStyle = `rgba(5, 2, 2, ${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
        
        // Subtle red vignette
        if (this.fadeProgress > 0.5) {
            const vignetteAlpha = (this.fadeProgress - 0.5) * 0.4;
            const gradient = ctx.createRadialGradient(w/2, h/2, h * 0.3, w/2, h/2, h * 0.8);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, `rgba(60, 0, 0, ${vignetteAlpha})`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
        }
        
        // Blood drip particles
        for (const drop of this.bloodDrops) {
            if (this.totalTime > drop.delay) {
                const dropAlpha = Math.min(1, (this.totalTime - drop.delay) * 0.5) * this.fadeProgress;
                ctx.fillStyle = `rgba(120, 10, 10, ${dropAlpha * 0.6})`;
                ctx.beginPath();
                ctx.ellipse(drop.x, drop.y, drop.size * 0.6, drop.size, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // "YOU DIED" text with Dark Souls styling
        if (this.textFadeProgress > 0) {
            ctx.save();
            
            // Pulse effect - subtle size oscillation
            const pulse = 1 + Math.sin(this.pulseTime * 2) * 0.02;
            
            // Text alpha with easing
            const textAlpha = this.easeOutCubic(this.textFadeProgress);
            
            // Dark red color, slightly desaturated like Dark Souls
            const red = Math.floor(180 + 20 * Math.sin(this.pulseTime));
            ctx.fillStyle = `rgba(${red}, 30, 30, ${textAlpha})`;
            
            // Use a more dramatic font
            const fontSize = Math.floor(72 * pulse);
            ctx.font = `bold ${fontSize}px "Times New Roman", Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Add text shadow/glow for depth
            ctx.shadowColor = `rgba(100, 0, 0, ${textAlpha * 0.8})`;
            ctx.shadowBlur = 30;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 5;
            
            // Draw the main text
            ctx.fillText('YOU DIED', w / 2, h / 2 - 40);
            
            // Reset shadow for second pass (glow effect)
            ctx.shadowColor = `rgba(255, 50, 50, ${textAlpha * 0.3})`;
            ctx.shadowBlur = 60;
            ctx.shadowOffsetY = 0;
            ctx.fillText('YOU DIED', w / 2, h / 2 - 40);
            
            ctx.restore();
        }
        
        // Horizontal line decoration (like Dark Souls)
        if (this.textFadeProgress > 0.5) {
            const lineAlpha = (this.textFadeProgress - 0.5) * 2;
            const lineWidth = 200 * lineAlpha;
            
            ctx.strokeStyle = `rgba(100, 20, 20, ${lineAlpha * 0.5})`;
            ctx.lineWidth = 1;
            
            // Top line
            ctx.beginPath();
            ctx.moveTo(w/2 - lineWidth, h/2 - 90);
            ctx.lineTo(w/2 + lineWidth, h/2 - 90);
            ctx.stroke();
            
            // Bottom line
            ctx.beginPath();
            ctx.moveTo(w/2 - lineWidth, h/2 + 10);
            ctx.lineTo(w/2 + lineWidth, h/2 + 10);
            ctx.stroke();
        }
        
        // Stats text
        if (this.statsProgress > 0) {
            const statsAlpha = this.easeOutCubic(this.statsProgress);
            ctx.fillStyle = `rgba(120, 100, 100, ${statsAlpha})`;
            ctx.font = '20px "Times New Roman", Georgia, serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillText(`Floor ${this.floor}  •  Level ${this.level}`, w / 2, h / 2 + 60);
        }
        
        // Restart prompt with slow pulse
        if (this.restartProgress > 0) {
            const promptAlpha = this.restartProgress * (0.4 + 0.3 * Math.sin(this.pulseTime * 1.5));
            ctx.fillStyle = `rgba(150, 140, 140, ${promptAlpha})`;
            ctx.font = '16px "Times New Roman", Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText('Press SPACE to try again', w / 2, h / 2 + 120);
        }
        
        ctx.textAlign = 'left';
    }
    
    // Easing function for smooth fade
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
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
        this.menuSoundManager = null;
    }
    
    async init() {
        // Create and initialize engine
        this.engine = new Engine('gameCanvas');
        
        // Create menu sound manager
        this.menuSoundManager = new SoundManager();
        
        // Set up class selection
        this.classSelectUI = new ClassSelectionUI(
            this.engine.canvas,
            ClassDefinitions,
            (className) => this.onClassSelected(className),
            this.menuSoundManager
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
        
        // Show cursor during class selection
        this.engine.canvas.style.cursor = 'default';
        
        // Start game loop
        this.engine.start((dt) => this.update(dt), (ctx) => this.render(ctx));
    }
    
    onClassSelected(className) {
        this.selectedClass = className;
        this.currentScene = new GameScene(this.engine, className);
        this.state = GameState.PLAYING;
        
        // Hide cursor during gameplay
        this.engine.canvas.style.cursor = 'none';
        
        // Play save sound when entering the game
        this.currentScene.soundManager.play('save', 0.6);
    }
    
    update(dt) {
        switch (this.state) {
            case GameState.CLASS_SELECT:
                // Class selection is handled by click events
                break;
                
            case GameState.PLAYING:
                if (this.currentScene) {
                    // Check if quit to menu was requested
                    if (this.currentScene.quitToMenu) {
                        this.state = GameState.CLASS_SELECT;
                        this.currentScene = null;
                        this.engine.canvas.style.cursor = 'default';
                        return;
                    }
                    
                    // Check if transitioning to market
                    if (this.currentScene.goToMarket) {
                        // Store reference to game scene
                        this.gameScene = this.currentScene;
                        
                        // Create market scene
                        this.currentScene = new MarketScene(
                            this.engine,
                            this.gameScene.player,
                            this.gameScene.currentFloor,
                            this.gameScene.currentFloorTheme
                        );
                        this.state = GameState.MARKET;
                        
                        // Show cursor in market
                        this.engine.canvas.style.cursor = 'default';
                        return;
                    }
                    
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
                
            case GameState.MARKET:
                if (this.currentScene) {
                    const result = this.currentScene.update(dt);
                    if (result === 'exitMarket') {
                        // Return to game scene and advance to next floor
                        this.gameScene.continueFromMarket();
                        
                        // Transfer mercenary to player if hired
                        if (this.currentScene.mercenary) {
                            this.gameScene.player.mercenary = this.currentScene.mercenary;
                        }
                        
                        this.currentScene = this.gameScene;
                        this.state = GameState.PLAYING;
                        
                        // Hide cursor during gameplay
                        this.engine.canvas.style.cursor = 'none';
                    }
                }
                break;
                
            case GameState.DEAD:
                if (this.currentScene) {
                    const result = this.currentScene.update(dt);
                    if (result === 'restart') {
                        this.state = GameState.CLASS_SELECT;
                        this.currentScene = null;
                        this.gameScene = null;
                        // Show cursor when returning to class selection
                        this.engine.canvas.style.cursor = 'default';
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
            case GameState.MARKET:
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
