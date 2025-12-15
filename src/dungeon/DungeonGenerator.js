/**
 * Dungeon Generator - Procedural dungeon generation
 */

import { Utils } from '../engine/core/Utils.js';

// Tile types constant for external use
export const TILE_TYPES = {
    VOID: 0,
    EMPTY: 0,
    FLOOR: 1,
    WALL: 2,
    DOOR: 3,
    STAIRS_DOWN: 4,
    STAIRS_UP: 5,
    CHEST: 6,
    TRAP: 7,
    WATER: 8,
    LAVA: 9,
    TORCH_UNLIT: 10,
    TORCH_LIT: 11,
    DUNGEON_CORE: 12,
    CORE_DOOR: 13 // Locked door to core room
};

// Add destructible object type
export const DESTRUCTIBLE_TYPES = {
    BARREL: 'barrel',
    CRATE: 'crate',
    POT: 'pot',
    EXPLOSIVE_BARREL: 'explosive_barrel'
};

export class DungeonGenerator {
    constructor(config = {}) {
        this.width = config.width || 150;
        this.height = config.height || 120;
        this.tileSize = config.tileSize || 32;
        this.minRoomSize = config.minRoomSize || 6;
        this.maxRoomSize = config.maxRoomSize || 16;
        this.maxRooms = config.maxRooms || 20;
        this.corridorWidth = config.corridorWidth || 3;
        
        // Boss room size
        this.bossRoomSize = config.bossRoomSize || 50;
        
        // Non-Euclidean space dimensions (world wraps at these boundaries)
        this.worldWidth = this.width * this.tileSize;
        this.worldHeight = this.height * this.tileSize;
        
        // Discovered tiles for minimap (fog of war)
        this.discoveredTiles = new Set();
        this.discoveryRadius = 8; // Tiles revealed around player
        
        this.tiles = [];
        this.rooms = [];
        this.corridors = [];
        this.spawnPoints = [];
        this.bossRoom = null;
        this.startRoom = null;
        this.coreRoom = null;
        this.torchRooms = [];
        this.torchPositions = [];
        this.corePosition = null;
        this.coreDoorPosition = null;
        
        // Non-euclidean tunnels that connect opposite edges
        this.wrapTunnels = [];
        
        // Destructible objects in rooms
        this.destructibles = [];
        
        // Tile types
        this.TILES = {
            VOID: 0,
            FLOOR: 1,
            WALL: 2,
            DOOR: 3,
            STAIRS_DOWN: 4,
            STAIRS_UP: 5,
            CHEST: 6,
            TRAP: 7,
            WATER: 8,
            LAVA: 9,
            TORCH_UNLIT: 10,
            TORCH_LIT: 11,
            DUNGEON_CORE: 12,
            CORE_DOOR: 13
        };
    }
    
    generate(config = {}) {
        // Extract floor from config, default to 1
        const floor = typeof config === 'number' ? config : (config.floor || 1);
        
        // Store config values
        if (typeof config === 'object') {
            this.width = config.width || this.width;
            this.height = config.height || this.height;
        }
        
        // Initialize with void
        this.tiles = [];
        this.rooms = [];
        this.corridors = [];
        this.spawnPoints = [];
        this.torchRooms = [];
        this.torchPositions = [];
        this.coreRoom = null;
        this.corePosition = null;
        this.coreDoorPosition = null;
        this.wrapTunnels = [];
        this.destructibles = [];
        
        // Reset discovered tiles for minimap (fresh fog of war each floor)
        this.discoveredTiles = new Set();
        
        for (let y = 0; y < this.height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.tiles[y][x] = this.TILES.VOID;
            }
        }
        
        // Generate rooms with proper 9ths placement for start and boss
        this.generateRoomsWithNinths();
        
        // Create wrap tunnels that connect opposite edges
        this.createWrapTunnels();
        
        // Connect rooms with corridors
        this.connectRooms();
        
        // Add walls around floor tiles
        this.addWalls();
        
        // Reinforce boss room walls to ensure proper containment
        this.reinforceBossRoomWalls();
        
        // Clear any walls incorrectly placed in wrap tunnel openings
        this.clearWrapTunnelWalls();
        
        // Place special tiles
        this.placeSpecialTiles(floor);
        
        // Generate hidden rooms
        this.generateHiddenRooms(floor);
        
        // Place torches and dungeon core
        this.placeTorchesAndCore(floor);
        
        // Place destructible objects in rooms
        this.placeDestructibles();
        
        // Generate spawn points
        this.generateSpawnPoints(floor);
        
        const tiles = this.tiles;
        const width = this.width;
        const height = this.height;
        const torchPositions = this.torchPositions;
        const corePosition = this.corePosition;
        const coreDoorPosition = this.coreDoorPosition;
        const coreRoom = this.coreRoom;
        const wrapTunnels = this.wrapTunnels;
        const destructibles = this.destructibles;
        
        return {
            tiles: tiles,
            rooms: this.rooms,
            corridors: this.corridors,
            spawnPoints: this.spawnPoints,
            startRoom: this.startRoom,
            bossRoom: this.bossRoom,
            coreRoom: coreRoom,
            hiddenRooms: this.hiddenRooms || [],
            torchPositions: torchPositions,
            corePosition: corePosition,
            coreDoorPosition: coreDoorPosition,
            wrapTunnels: wrapTunnels,
            destructibles: destructibles,
            width: width,
            height: height,
            tileSize: this.tileSize,
            worldWidth: this.worldWidth,
            worldHeight: this.worldHeight,
            discoveredTiles: this.discoveredTiles,
            discoveryRadius: this.discoveryRadius,
            
            // Helper method to get tile at position (with wrapping for non-Euclidean space)
            getTile(x, y) {
                // Wrap coordinates for seamless non-Euclidean space
                const wrappedX = ((x % width) + width) % width;
                const wrappedY = ((y % height) + height) % height;
                return tiles[wrappedY]?.[wrappedX] ?? TILE_TYPES.WALL;
            },
            
            // Wrap world position for non-Euclidean space
            wrapPosition(x, y) {
                const worldW = width * 32;
                const worldH = height * 32;
                return {
                    x: ((x % worldW) + worldW) % worldW,
                    y: ((y % worldH) + worldH) % worldH
                };
            },
            
            // Update discovered tiles around a position
            discoverArea(worldX, worldY, radius = 8) {
                const tileX = Math.floor(worldX / 32);
                const tileY = Math.floor(worldY / 32);
                
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        if (dx * dx + dy * dy <= radius * radius) {
                            const checkX = ((tileX + dx) % width + width) % width;
                            const checkY = ((tileY + dy) % height + height) % height;
                            this.discoveredTiles.add(`${checkX},${checkY}`);
                        }
                    }
                }
            },
            
            // Check if tile is discovered
            isTileDiscovered(tileX, tileY) {
                const wrappedX = ((tileX % width) + width) % width;
                const wrappedY = ((tileY % height) + height) % height;
                return this.discoveredTiles.has(`${wrappedX},${wrappedY}`);
            }
        };
    }
    
    // Get the 9th grid position (A-I as described: A B C / D E F / G H I)
    getNinthFromPosition(x, y) {
        const thirdW = Math.floor(this.width / 3);
        const thirdH = Math.floor(this.height / 3);
        const col = Math.min(2, Math.floor(x / thirdW));
        const row = Math.min(2, Math.floor(y / thirdH));
        const ninths = [
            ['A', 'B', 'C'],
            ['D', 'E', 'F'],
            ['G', 'H', 'I']
        ];
        return { ninth: ninths[row][col], col, row };
    }
    
    // Generate rooms with 9ths-based placement for start and boss
    generateRoomsWithNinths() {
        const thirdW = Math.floor(this.width / 3);
        const thirdH = Math.floor(this.height / 3);
        
        // Pick random start position in central-ish ninths (D, E, F or B, E, H - not corners)
        const startNinths = ['D', 'E', 'F', 'B', 'H'];
        const startNinth = startNinths[Math.floor(Math.random() * startNinths.length)];
        const startPos = this.getRandomPositionInNinth(startNinth);
        
        // Create start room at the selected position
        const startRoomSize = Utils.randomInt(8, 12);
        const startRoom = {
            x: Math.max(2, Math.min(this.width - startRoomSize - 2, startPos.x - Math.floor(startRoomSize / 2))),
            y: Math.max(2, Math.min(this.height - startRoomSize - 2, startPos.y - Math.floor(startRoomSize / 2))),
            width: startRoomSize,
            height: startRoomSize,
            centerX: 0,
            centerY: 0,
            connections: [],
            isStartRoom: true,
            contains(px, py) {
                return px >= this.x && px < this.x + this.width &&
                       py >= this.y && py < this.y + this.height;
            }
        };
        startRoom.centerX = Math.floor(startRoom.x + startRoom.width / 2);
        startRoom.centerY = Math.floor(startRoom.y + startRoom.height / 2);
        
        this.rooms.push(startRoom);
        this.carveRoom(startRoom);
        this.startRoom = startRoom;
        
        // Find the furthest 9th from start for boss room
        const startNinthInfo = this.getNinthFromPosition(startRoom.centerX, startRoom.centerY);
        const oppositeNinths = this.getFurthestNinths(startNinthInfo.col, startNinthInfo.row);
        const bossNinth = oppositeNinths[Math.floor(Math.random() * oppositeNinths.length)];
        
        // Create boss room in the furthest 9th
        this.createBossRoomInNinth(bossNinth);
        
        // Generate regular rooms avoiding start and boss ninths
        let attempts = 0;
        const maxAttempts = 500;
        
        while (this.rooms.length < this.maxRooms && attempts < maxAttempts) {
            attempts++;
            
            const roomWidth = Utils.randomInt(this.minRoomSize, this.maxRoomSize);
            const roomHeight = Utils.randomInt(this.minRoomSize, this.maxRoomSize);
            const x = Utils.randomInt(2, this.width - roomWidth - 2);
            const y = Utils.randomInt(2, this.height - roomHeight - 2);
            
            const newRoom = {
                x, y,
                width: roomWidth,
                height: roomHeight,
                centerX: Math.floor(x + roomWidth / 2),
                centerY: Math.floor(y + roomHeight / 2),
                connections: [],
                contains(px, py) {
                    return px >= this.x && px < this.x + this.width &&
                           py >= this.y && py < this.y + this.height;
                }
            };
            
            // Check for overlap with existing rooms
            let overlaps = false;
            for (const room of this.rooms) {
                if (this.roomsOverlap(newRoom, room, 2)) {
                    overlaps = true;
                    break;
                }
            }
            
            if (!overlaps) {
                this.rooms.push(newRoom);
                this.carveRoom(newRoom);
            }
        }
    }
    
    getRandomPositionInNinth(ninth) {
        const thirdW = Math.floor(this.width / 3);
        const thirdH = Math.floor(this.height / 3);
        
        const ninthPositions = {
            'A': { col: 0, row: 0 }, 'B': { col: 1, row: 0 }, 'C': { col: 2, row: 0 },
            'D': { col: 0, row: 1 }, 'E': { col: 1, row: 1 }, 'F': { col: 2, row: 1 },
            'G': { col: 0, row: 2 }, 'H': { col: 1, row: 2 }, 'I': { col: 2, row: 2 }
        };
        
        const pos = ninthPositions[ninth];
        const margin = 5;
        return {
            x: pos.col * thirdW + margin + Utils.randomInt(0, thirdW - margin * 2),
            y: pos.row * thirdH + margin + Utils.randomInt(0, thirdH - margin * 2)
        };
    }
    
    getFurthestNinths(col, row) {
        // Return ninths that are diagonally or directly opposite
        const furthest = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const dist = Math.abs(c - col) + Math.abs(r - row);
                if (dist >= 2) { // At least 2 steps away
                    const ninths = [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']];
                    furthest.push(ninths[r][c]);
                }
            }
        }
        return furthest.length > 0 ? furthest : ['I']; // Default to corner I
    }
    
    createBossRoomInNinth(ninth) {
        const thirdW = Math.floor(this.width / 3);
        const thirdH = Math.floor(this.height / 3);
        const size = this.bossRoomSize;
        
        const ninthPositions = {
            'A': { col: 0, row: 0 }, 'B': { col: 1, row: 0 }, 'C': { col: 2, row: 0 },
            'D': { col: 0, row: 1 }, 'E': { col: 1, row: 1 }, 'F': { col: 2, row: 1 },
            'G': { col: 0, row: 2 }, 'H': { col: 1, row: 2 }, 'I': { col: 2, row: 2 }
        };
        
        const pos = ninthPositions[ninth];
        
        // Center the boss room in the selected ninth
        let bestX = pos.col * thirdW + Math.floor((thirdW - size) / 2);
        let bestY = pos.row * thirdH + Math.floor((thirdH - size) / 2);
        
        // Clamp to valid positions
        bestX = Math.max(2, Math.min(this.width - size - 2, bestX));
        bestY = Math.max(2, Math.min(this.height - size - 2, bestY));
        
        const bossRoom = {
            x: bestX,
            y: bestY,
            width: size,
            height: size,
            centerX: Math.floor(bestX + size / 2),
            centerY: Math.floor(bestY + size / 2),
            connections: [],
            isBossRoom: true,
            contains(px, py) {
                return px >= this.x && px < this.x + this.width &&
                       py >= this.y && py < this.y + this.height;
            }
        };
        
        this.rooms.push(bossRoom);
        this.bossRoom = bossRoom;
        
        // Carve boss room
        for (let y = bossRoom.y; y < bossRoom.y + bossRoom.height; y++) {
            for (let x = bossRoom.x; x < bossRoom.x + bossRoom.width; x++) {
                if (this.isInBounds(x, y)) {
                    this.tiles[y][x] = this.TILES.FLOOR;
                }
            }
        }
        
        // Connect boss room to nearest regular room
        if (this.rooms.length > 1) {
            let nearestRoom = null;
            let nearestDist = Infinity;
            
            for (const room of this.rooms) {
                if (room === bossRoom) continue;
                const dist = Math.sqrt(
                    Math.pow(room.centerX - bossRoom.centerX, 2) +
                    Math.pow(room.centerY - bossRoom.centerY, 2)
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestRoom = room;
                }
            }
            
            if (nearestRoom) {
                this.createWideCorridor(nearestRoom.centerX, nearestRoom.centerY, 
                                        bossRoom.x - 1, bossRoom.centerY, 3);
            }
        }
    }
    
    // Create tunnels on edges that wrap to the opposite side
    createWrapTunnels() {
        const tunnelWidth = 5;
        const thirdW = Math.floor(this.width / 3);
        const thirdH = Math.floor(this.height / 3);
        
        // Get ninths occupied by start and boss rooms
        const startNinth = this.startRoom ? this.getNinthFromPosition(this.startRoom.centerX, this.startRoom.centerY).ninth : 'E';
        const bossNinth = this.bossRoom ? this.getNinthFromPosition(this.bossRoom.centerX, this.bossRoom.centerY).ninth : 'I';
        const occupiedNinths = new Set([startNinth, bossNinth]);
        
        // Top edge tunnels (B connects to H)
        const topEdgeNinths = ['A', 'B', 'C'];
        const bottomEdgeNinths = ['G', 'H', 'I'];
        const leftEdgeNinths = ['A', 'D', 'G'];
        const rightEdgeNinths = ['C', 'F', 'I'];
        
        // Create 2-3 horizontal wrap tunnels (top <-> bottom)
        const numHorizontalTunnels = 2 + Math.floor(Math.random() * 2);
        const usedHCols = new Set();
        
        for (let i = 0; i < numHorizontalTunnels; i++) {
            // Pick a column (0, 1, or 2) not in occupied ninths
            const availableCols = [0, 1, 2].filter(col => {
                const topNinth = topEdgeNinths[col];
                const bottomNinth = bottomEdgeNinths[col];
                return !occupiedNinths.has(topNinth) && !occupiedNinths.has(bottomNinth) && !usedHCols.has(col);
            });
            
            if (availableCols.length === 0) continue;
            const col = availableCols[Math.floor(Math.random() * availableCols.length)];
            usedHCols.add(col);
            
            // Calculate x position within this third
            const tunnelX = col * thirdW + Math.floor(thirdW / 2);
            
            // Create tunnel opening at top edge (y = 0) - extend deep enough to connect
            for (let dx = -Math.floor(tunnelWidth / 2); dx <= Math.floor(tunnelWidth / 2); dx++) {
                const tx = tunnelX + dx;
                if (tx >= 0 && tx < this.width) {
                    // Top edge opening - extend 12 tiles into map
                    for (let dy = 0; dy < 12; dy++) {
                        if (this.isInBounds(tx, dy)) {
                            this.tiles[dy][tx] = this.TILES.FLOOR;
                        }
                    }
                    // Bottom edge opening - extend 12 tiles into map
                    for (let dy = this.height - 12; dy < this.height; dy++) {
                        if (this.isInBounds(tx, dy)) {
                            this.tiles[dy][tx] = this.TILES.FLOOR;
                        }
                    }
                }
            }
            
            this.wrapTunnels.push({
                type: 'vertical',
                x: tunnelX,
                width: tunnelWidth,
                topY: 0,
                bottomY: this.height - 1
            });
        }
        
        // Create 2-3 vertical wrap tunnels (left <-> right)
        const numVerticalTunnels = 2 + Math.floor(Math.random() * 2);
        const usedVRows = new Set();
        
        for (let i = 0; i < numVerticalTunnels; i++) {
            // Pick a row (0, 1, or 2) not in occupied ninths
            const availableRows = [0, 1, 2].filter(row => {
                const leftNinth = leftEdgeNinths[row];
                const rightNinth = rightEdgeNinths[row];
                return !occupiedNinths.has(leftNinth) && !occupiedNinths.has(rightNinth) && !usedVRows.has(row);
            });
            
            if (availableRows.length === 0) continue;
            const row = availableRows[Math.floor(Math.random() * availableRows.length)];
            usedVRows.add(row);
            
            // Calculate y position within this third
            const tunnelY = row * thirdH + Math.floor(thirdH / 2);
            
            // Create tunnel opening at left edge (x = 0) - extend deep enough to connect
            for (let dy = -Math.floor(tunnelWidth / 2); dy <= Math.floor(tunnelWidth / 2); dy++) {
                const ty = tunnelY + dy;
                if (ty >= 0 && ty < this.height) {
                    // Left edge opening - extend 12 tiles into map
                    for (let dx = 0; dx < 12; dx++) {
                        if (this.isInBounds(dx, ty)) {
                            this.tiles[ty][dx] = this.TILES.FLOOR;
                        }
                    }
                    // Right edge opening - extend 12 tiles into map
                    for (let dx = this.width - 12; dx < this.width; dx++) {
                        if (this.isInBounds(dx, ty)) {
                            this.tiles[ty][dx] = this.TILES.FLOOR;
                        }
                    }
                }
            }
            
            this.wrapTunnels.push({
                type: 'horizontal',
                y: tunnelY,
                height: tunnelWidth,
                leftX: 0,
                rightX: this.width - 1
            });
        }
        
        // Connect wrap tunnels to nearby rooms
        for (const tunnel of this.wrapTunnels) {
            this.connectTunnelToNearestRoom(tunnel);
        }
    }
    
    connectTunnelToNearestRoom(tunnel) {
        // Connect BOTH ends of tunnel to nearest rooms to prevent islands
        const connectPoints = [];
        
        if (tunnel.type === 'vertical') {
            // Connect near top and near bottom
            connectPoints.push({ x: tunnel.x, y: 10 }); // Top end
            connectPoints.push({ x: tunnel.x, y: this.height - 10 }); // Bottom end
        } else {
            // Connect near left and near right
            connectPoints.push({ x: 10, y: tunnel.y }); // Left end
            connectPoints.push({ x: this.width - 10, y: tunnel.y }); // Right end
        }
        
        for (const point of connectPoints) {
            let nearestRoom = null;
            let nearestDist = Infinity;
            
            for (const room of this.rooms) {
                const dist = Math.sqrt(
                    Math.pow(room.centerX - point.x, 2) +
                    Math.pow(room.centerY - point.y, 2)
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestRoom = room;
                }
            }
            
            if (nearestRoom && nearestDist > 5) {
                this.createWideCorridor(point.x, point.y, 
                                        nearestRoom.centerX, nearestRoom.centerY, 3);
            }
        }
    }
    
    // Place destructible objects in rooms (min 2 tiles from walls)
    placeDestructibles() {
        const destructibleTypes = ['barrel', 'crate', 'pot', 'explosive_barrel'];
        
        for (const room of this.rooms) {
            if (room.isBossRoom) continue; // No destructibles in boss room
            
            // Calculate safe area (2 tiles from walls)
            const margin = 2;
            const safeX1 = room.x + margin;
            const safeY1 = room.y + margin;
            const safeX2 = room.x + room.width - margin - 1;
            const safeY2 = room.y + room.height - margin - 1;
            
            if (safeX2 <= safeX1 || safeY2 <= safeY1) continue; // Room too small
            
            // Place 0-4 destructibles per room
            const numDestructibles = Math.floor(Math.random() * 4);
            
            for (let i = 0; i < numDestructibles; i++) {
                const dx = Utils.randomInt(safeX1, safeX2);
                const dy = Utils.randomInt(safeY1, safeY2);
                
                // Check if position is floor and not occupied
                if (this.tiles[dy][dx] !== this.TILES.FLOOR) continue;
                
                // Check not too close to other destructibles
                let tooClose = false;
                for (const d of this.destructibles) {
                    if (Math.abs(d.tileX - dx) < 2 && Math.abs(d.tileY - dy) < 2) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;
                
                // 15% chance for explosive barrel
                const type = Math.random() < 0.15 ? 'explosive_barrel' : 
                             destructibleTypes[Math.floor(Math.random() * 3)];
                
                this.destructibles.push({
                    type: type,
                    tileX: dx,
                    tileY: dy,
                    x: dx * this.tileSize + this.tileSize / 2,
                    y: dy * this.tileSize + this.tileSize / 2,
                    health: type === 'explosive_barrel' ? 15 : 25,
                    maxHealth: type === 'explosive_barrel' ? 15 : 25,
                    explodes: type === 'explosive_barrel',
                    explosionDamage: 50,
                    explosionRadius: 80
                });
            }
        }
    }
    
    generateRooms() {
        let attempts = 0;
        const maxAttempts = 500;
        
        while (this.rooms.length < this.maxRooms && attempts < maxAttempts) {
            attempts++;
            
            const roomWidth = Utils.randomInt(this.minRoomSize, this.maxRoomSize);
            const roomHeight = Utils.randomInt(this.minRoomSize, this.maxRoomSize);
            const x = Utils.randomInt(2, this.width - roomWidth - 2);
            const y = Utils.randomInt(2, this.height - roomHeight - 2);
            
            const newRoom = {
                x, y,
                width: roomWidth,
                height: roomHeight,
                centerX: Math.floor(x + roomWidth / 2),
                centerY: Math.floor(y + roomHeight / 2),
                connections: [],
                contains(px, py) {
                    return px >= this.x && px < this.x + this.width &&
                           py >= this.y && py < this.y + this.height;
                }
            };
            
            // Check for overlap with existing rooms
            let overlaps = false;
            for (const room of this.rooms) {
                if (this.roomsOverlap(newRoom, room, 2)) {
                    overlaps = true;
                    break;
                }
            }
            
            if (!overlaps) {
                this.rooms.push(newRoom);
                this.carveRoom(newRoom);
            }
        }
        
        // Set start room
        if (this.rooms.length > 0) {
            this.startRoom = this.rooms[0];
        }
        
        // Create large boss room (50x50) in a separate area
        this.createBossRoom();
    }
    
    createBossRoom() {
        const size = this.bossRoomSize;
        
        // Find a location for the boss room (far from start, with space)
        let bestX = this.width - size - 5;
        let bestY = this.height - size - 5;
        
        // Make sure it fits
        if (bestX < 5) bestX = 5;
        if (bestY < 5) bestY = 5;
        
        // Create the boss room
        const bossRoom = {
            x: bestX,
            y: bestY,
            width: size,
            height: size,
            centerX: Math.floor(bestX + size / 2),
            centerY: Math.floor(bestY + size / 2),
            connections: [],
            isBossRoom: true,
            contains(px, py) {
                return px >= this.x && px < this.x + this.width &&
                       py >= this.y && py < this.y + this.height;
            }
        };
        
        this.rooms.push(bossRoom);
        this.bossRoom = bossRoom;
        
        // Carve out the boss room
        for (let y = bossRoom.y; y < bossRoom.y + bossRoom.height; y++) {
            for (let x = bossRoom.x; x < bossRoom.x + bossRoom.width; x++) {
                if (this.isInBounds(x, y)) {
                    this.tiles[y][x] = this.TILES.FLOOR;
                }
            }
        }
        
        // Walls are added by addWalls() and reinforced by reinforceBossRoomWalls()
        // No need to add them here as it causes issues with corridors
        
        // Connect boss room to nearest regular room
        if (this.rooms.length > 1) {
            let nearestRoom = null;
            let nearestDist = Infinity;
            
            for (const room of this.rooms) {
                if (room === bossRoom) continue;
                const dist = Math.sqrt(
                    Math.pow(room.centerX - bossRoom.centerX, 2) +
                    Math.pow(room.centerY - bossRoom.centerY, 2)
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestRoom = room;
                }
            }
            
            if (nearestRoom) {
                // Create wide corridor to boss room
                this.createWideCorridor(nearestRoom.centerX, nearestRoom.centerY, 
                                        bossRoom.x - 1, bossRoom.centerY, 3);
            }
        }
    }
    
    createWideCorridor(x1, y1, x2, y2, width) {
        const halfWidth = Math.floor(width / 2);
        
        // L-shaped corridor
        const midX = x2;
        
        // Horizontal segment
        for (let x = Math.min(x1, midX); x <= Math.max(x1, midX); x++) {
            for (let w = -halfWidth; w <= halfWidth; w++) {
                const y = y1 + w;
                if (this.isInBounds(x, y) && this.tiles[y][x] !== this.TILES.FLOOR) {
                    this.tiles[y][x] = this.TILES.FLOOR;
                }
            }
        }
        
        // Vertical segment
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            for (let w = -halfWidth; w <= halfWidth; w++) {
                const x = midX + w;
                if (this.isInBounds(x, y) && this.tiles[y][x] !== this.TILES.FLOOR) {
                    this.tiles[y][x] = this.TILES.FLOOR;
                }
            }
        }
    }
    
    roomsOverlap(roomA, roomB, padding = 1) {
        return !(roomA.x + roomA.width + padding < roomB.x ||
                 roomB.x + roomB.width + padding < roomA.x ||
                 roomA.y + roomA.height + padding < roomB.y ||
                 roomB.y + roomB.height + padding < roomA.y);
    }
    
    carveRoom(room) {
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                if (this.isInBounds(x, y)) {
                    this.tiles[y][x] = this.TILES.FLOOR;
                }
            }
        }
    }
    
    connectRooms() {
        // Use minimum spanning tree approach
        const connected = [this.rooms[0]];
        const unconnected = this.rooms.slice(1);
        
        while (unconnected.length > 0) {
            let bestDist = Infinity;
            let bestPair = null;
            let bestUnconnectedIndex = -1;
            
            // Find closest pair between connected and unconnected
            for (const connectedRoom of connected) {
                for (let i = 0; i < unconnected.length; i++) {
                    const dist = Utils.distance(
                        connectedRoom.centerX, connectedRoom.centerY,
                        unconnected[i].centerX, unconnected[i].centerY
                    );
                    
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestPair = [connectedRoom, unconnected[i]];
                        bestUnconnectedIndex = i;
                    }
                }
            }
            
            if (bestPair) {
                this.carveCorridor(bestPair[0], bestPair[1]);
                bestPair[0].connections.push(bestPair[1]);
                bestPair[1].connections.push(bestPair[0]);
                
                connected.push(unconnected[bestUnconnectedIndex]);
                unconnected.splice(bestUnconnectedIndex, 1);
            }
        }
        
        // Add some extra connections for variety
        const extraConnections = Math.floor(this.rooms.length * 0.3);
        for (let i = 0; i < extraConnections; i++) {
            const roomA = Utils.randomChoice(this.rooms);
            const roomB = Utils.randomChoice(this.rooms);
            
            if (roomA !== roomB && !roomA.connections.includes(roomB)) {
                this.carveCorridor(roomA, roomB);
                roomA.connections.push(roomB);
                roomB.connections.push(roomA);
            }
        }
    }
    
    carveCorridor(roomA, roomB) {
        const x1 = roomA.centerX;
        const y1 = roomA.centerY;
        const x2 = roomB.centerX;
        const y2 = roomB.centerY;
        
        const corridor = {
            from: roomA,
            to: roomB,
            points: []
        };
        
        // L-shaped corridor
        const horizontal = Math.random() < 0.5;
        
        if (horizontal) {
            // Horizontal first, then vertical
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
                for (let w = 0; w < this.corridorWidth; w++) {
                    const y = y1 + w - Math.floor(this.corridorWidth / 2);
                    if (this.isInBounds(x, y)) {
                        this.tiles[y][x] = this.TILES.FLOOR;
                        corridor.points.push({ x, y });
                    }
                }
            }
            for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
                for (let w = 0; w < this.corridorWidth; w++) {
                    const x = x2 + w - Math.floor(this.corridorWidth / 2);
                    if (this.isInBounds(x, y)) {
                        this.tiles[y][x] = this.TILES.FLOOR;
                        corridor.points.push({ x, y });
                    }
                }
            }
        } else {
            // Vertical first, then horizontal
            for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
                for (let w = 0; w < this.corridorWidth; w++) {
                    const x = x1 + w - Math.floor(this.corridorWidth / 2);
                    if (this.isInBounds(x, y)) {
                        this.tiles[y][x] = this.TILES.FLOOR;
                        corridor.points.push({ x, y });
                    }
                }
            }
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
                for (let w = 0; w < this.corridorWidth; w++) {
                    const y = y2 + w - Math.floor(this.corridorWidth / 2);
                    if (this.isInBounds(x, y)) {
                        this.tiles[y][x] = this.TILES.FLOOR;
                        corridor.points.push({ x, y });
                    }
                }
            }
        }
        
        this.corridors.push(corridor);
    }
    
    addWalls() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.tiles[y][x] === this.TILES.VOID) {
                    // Check if adjacent to floor
                    if (this.hasAdjacentFloor(x, y)) {
                        this.tiles[y][x] = this.TILES.WALL;
                    }
                }
            }
        }
    }
    
    hasAdjacentFloor(x, y) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (this.isInBounds(nx, ny) && this.tiles[ny][nx] === this.TILES.FLOOR) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // Reinforce boss room walls to ensure proper containment
    // This fixes issues where corridors might break through boss room boundaries
    reinforceBossRoomWalls() {
        if (!this.bossRoom) return;
        
        const br = this.bossRoom;
        
        // Define the perimeter of the boss room (1 tile outside)
        // Only add walls where there isn't already a floor tile connecting to a corridor
        
        // First, mark all corridor entry points (floor tiles that connect to outside)
        const corridorEntries = new Set();
        
        // Check all 4 sides for corridor connections
        // Left side
        for (let y = br.y; y < br.y + br.height; y++) {
            const x = br.x - 1;
            if (this.isInBounds(x - 1, y) && this.tiles[y][x - 1] === this.TILES.FLOOR) {
                corridorEntries.add(`${x},${y}`);
            }
        }
        // Right side
        for (let y = br.y; y < br.y + br.height; y++) {
            const x = br.x + br.width;
            if (this.isInBounds(x + 1, y) && this.tiles[y][x + 1] === this.TILES.FLOOR) {
                corridorEntries.add(`${x},${y}`);
            }
        }
        // Top side
        for (let x = br.x; x < br.x + br.width; x++) {
            const y = br.y - 1;
            if (this.isInBounds(x, y - 1) && this.tiles[y - 1][x] === this.TILES.FLOOR) {
                corridorEntries.add(`${x},${y}`);
            }
        }
        // Bottom side
        for (let x = br.x; x < br.x + br.width; x++) {
            const y = br.y + br.height;
            if (this.isInBounds(x, y + 1) && this.tiles[y + 1][x] === this.TILES.FLOOR) {
                corridorEntries.add(`${x},${y}`);
            }
        }
        
        // Now add walls around the boss room perimeter, but keep corridor entries as floor
        for (let y = br.y - 1; y <= br.y + br.height; y++) {
            for (let x = br.x - 1; x <= br.x + br.width; x++) {
                if (!this.isInBounds(x, y)) continue;
                
                // Skip interior floor tiles
                if (x >= br.x && x < br.x + br.width && 
                    y >= br.y && y < br.y + br.height) {
                    continue;
                }
                
                // Skip corridor entry points
                if (corridorEntries.has(`${x},${y}`)) {
                    this.tiles[y][x] = this.TILES.FLOOR; // Ensure it's floor
                    continue;
                }
                
                // For perimeter tiles, ensure they're walls if not floor
                if (this.tiles[y][x] === this.TILES.VOID) {
                    this.tiles[y][x] = this.TILES.WALL;
                }
            }
        }
        
        // Ensure no random holes by checking for void tiles adjacent to boss room interior
        for (let y = br.y - 2; y <= br.y + br.height + 1; y++) {
            for (let x = br.x - 2; x <= br.x + br.width + 1; x++) {
                if (!this.isInBounds(x, y)) continue;
                
                // If this is a void tile adjacent to boss room floor, make it a wall
                if (this.tiles[y][x] === this.TILES.VOID) {
                    // Check if adjacent to boss room floor
                    let adjacentToBossFloor = false;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= br.x && nx < br.x + br.width &&
                                ny >= br.y && ny < br.y + br.height) {
                                adjacentToBossFloor = true;
                                break;
                            }
                        }
                        if (adjacentToBossFloor) break;
                    }
                    
                    if (adjacentToBossFloor) {
                        this.tiles[y][x] = this.TILES.WALL;
                    }
                }
            }
        }
    }
    
    clearWrapTunnelWalls() {
        // Clear any walls that were placed inside wrap tunnel openings
        // This ensures tunnels at map edges are fully passable
        const tunnelWidth = 5;
        const tunnelDepth = 12;
        
        for (const tunnel of this.wrapTunnels) {
            if (tunnel.type === 'vertical') {
                // Clear walls in top and bottom tunnel openings
                const halfWidth = Math.floor(tunnelWidth / 2);
                for (let dx = -halfWidth; dx <= halfWidth; dx++) {
                    const tx = tunnel.x + dx;
                    if (tx >= 0 && tx < this.width) {
                        // Top opening
                        for (let dy = 0; dy < tunnelDepth; dy++) {
                            if (this.isInBounds(tx, dy) && this.tiles[dy][tx] === this.TILES.WALL) {
                                this.tiles[dy][tx] = this.TILES.FLOOR;
                            }
                        }
                        // Bottom opening
                        for (let dy = this.height - tunnelDepth; dy < this.height; dy++) {
                            if (this.isInBounds(tx, dy) && this.tiles[dy][tx] === this.TILES.WALL) {
                                this.tiles[dy][tx] = this.TILES.FLOOR;
                            }
                        }
                    }
                }
            } else {
                // Clear walls in left and right tunnel openings
                const halfHeight = Math.floor(tunnel.height / 2);
                for (let dy = -halfHeight; dy <= halfHeight; dy++) {
                    const ty = tunnel.y + dy;
                    if (ty >= 0 && ty < this.height) {
                        // Left opening
                        for (let dx = 0; dx < tunnelDepth; dx++) {
                            if (this.isInBounds(dx, ty) && this.tiles[ty][dx] === this.TILES.WALL) {
                                this.tiles[ty][dx] = this.TILES.FLOOR;
                            }
                        }
                        // Right opening
                        for (let dx = this.width - tunnelDepth; dx < this.width; dx++) {
                            if (this.isInBounds(dx, ty) && this.tiles[ty][dx] === this.TILES.WALL) {
                                this.tiles[ty][dx] = this.TILES.FLOOR;
                            }
                        }
                    }
                }
            }
        }
    }
    
    placeSpecialTiles(floor) {
        // Place stairs up in start room
        if (this.startRoom) {
            const x = this.startRoom.centerX;
            const y = this.startRoom.centerY;
            this.tiles[y][x] = this.TILES.STAIRS_UP;
        }
        
        // Place stairs down in boss room
        if (this.bossRoom) {
            const x = this.bossRoom.centerX;
            const y = this.bossRoom.centerY;
            this.tiles[y][x] = this.TILES.STAIRS_DOWN;
        }
        
        // Place chests in some rooms
        for (const room of this.rooms) {
            if (room === this.startRoom || room === this.bossRoom) continue;
            
            if (Math.random() < 0.3) {
                const x = room.x + Utils.randomInt(1, room.width - 2);
                const y = room.y + Utils.randomInt(1, room.height - 2);
                if (this.tiles[y][x] === this.TILES.FLOOR) {
                    this.tiles[y][x] = this.TILES.CHEST;
                }
            }
        }
        
        // Place trapped chests rarely (replaces floor traps)
        const trappedChestChance = Math.min(0.03, 0.01 + floor * 0.003);
        for (const room of this.rooms) {
            // Skip start and boss rooms
            if (room === this.startRoom || room === this.bossRoom) continue;
            
            if (Math.random() < trappedChestChance * 3) {
                const x = room.x + Utils.randomInt(1, room.width - 2);
                const y = room.y + Utils.randomInt(1, room.height - 2);
                if (this.tiles[y][x] === this.TILES.FLOOR) {
                    this.tiles[y][x] = this.TILES.TRAP; // Will be rendered as trapped chest
                }
            }
        }
    }
    
    generateHiddenRooms(floor) {
        // Hidden rooms are secret rooms attached to normal rooms
        // They contain rare loot and are revealed by finding breakable walls
        
        this.hiddenRooms = [];
        
        // Chance of hidden room per normal room increases with floor
        const hiddenRoomChance = Math.min(0.3, 0.1 + floor * 0.02);
        
        // Find eligible rooms (not start, boss, or core)
        const eligibleRooms = this.rooms.filter(room => 
            room !== this.startRoom && room !== this.bossRoom && room !== this.coreRoom
        );
        
        for (const room of eligibleRooms) {
            if (Math.random() > hiddenRoomChance) continue;
            
            // Pick a random wall side (0=top, 1=right, 2=bottom, 3=left)
            const sides = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
            
            for (const side of sides) {
                const hiddenRoom = this.tryPlaceHiddenRoom(room, side, floor);
                if (hiddenRoom) {
                    this.hiddenRooms.push(hiddenRoom);
                    break; // Only one hidden room per normal room
                }
            }
        }
    }
    
    tryPlaceHiddenRoom(parentRoom, side, floor) {
        // Hidden room size (small, 5x5 to 8x8)
        const width = Utils.randomInt(5, 8);
        const height = Utils.randomInt(5, 8);
        
        let hiddenX, hiddenY, doorX, doorY;
        
        switch (side) {
            case 0: // Top
                hiddenX = parentRoom.centerX - Math.floor(width / 2);
                hiddenY = parentRoom.y - height - 1;
                doorX = parentRoom.centerX;
                doorY = parentRoom.y - 1;
                break;
            case 1: // Right
                hiddenX = parentRoom.x + parentRoom.width + 1;
                hiddenY = parentRoom.centerY - Math.floor(height / 2);
                doorX = parentRoom.x + parentRoom.width;
                doorY = parentRoom.centerY;
                break;
            case 2: // Bottom
                hiddenX = parentRoom.centerX - Math.floor(width / 2);
                hiddenY = parentRoom.y + parentRoom.height + 1;
                doorX = parentRoom.centerX;
                doorY = parentRoom.y + parentRoom.height;
                break;
            case 3: // Left
                hiddenX = parentRoom.x - width - 1;
                hiddenY = parentRoom.centerY - Math.floor(height / 2);
                doorX = parentRoom.x - 1;
                doorY = parentRoom.centerY;
                break;
        }
        
        // Check bounds
        if (hiddenX < 2 || hiddenY < 2 || 
            hiddenX + width >= this.width - 2 || 
            hiddenY + height >= this.height - 2) {
            return null;
        }
        
        // Check if area is clear (all void)
        for (let y = hiddenY - 1; y <= hiddenY + height; y++) {
            for (let x = hiddenX - 1; x <= hiddenX + width; x++) {
                if (!this.isInBounds(x, y)) return null;
                if (this.tiles[y][x] !== this.TILES.VOID) return null;
            }
        }
        
        // Place the hidden room floor
        for (let y = hiddenY; y < hiddenY + height; y++) {
            for (let x = hiddenX; x < hiddenX + width; x++) {
                this.tiles[y][x] = this.TILES.FLOOR;
            }
        }
        
        // Add walls around the hidden room
        for (let y = hiddenY - 1; y <= hiddenY + height; y++) {
            for (let x = hiddenX - 1; x <= hiddenX + width; x++) {
                if (this.tiles[y][x] === this.TILES.VOID) {
                    this.tiles[y][x] = this.TILES.WALL;
                }
            }
        }
        
        // Create the secret passage (breakable wall)
        // Mark it as a special breakable wall tile
        if (this.isInBounds(doorX, doorY)) {
            // Use WALL but mark as breakable (we'll track these separately)
            this.tiles[doorY][doorX] = this.TILES.WALL;
        }
        
        // Create short corridor to hidden room
        let corridorX = doorX, corridorY = doorY;
        switch (side) {
            case 0: // Top - corridor goes up
                for (let y = doorY; y >= hiddenY + height - 1; y--) {
                    if (this.isInBounds(corridorX, y)) {
                        if (y === doorY) {
                            // Keep as breakable wall (entry)
                        } else {
                            this.tiles[y][corridorX] = this.TILES.FLOOR;
                        }
                    }
                }
                break;
            case 1: // Right - corridor goes right
                for (let x = doorX; x <= hiddenX; x++) {
                    if (this.isInBounds(x, corridorY)) {
                        if (x === doorX) {
                            // Keep as breakable wall
                        } else {
                            this.tiles[corridorY][x] = this.TILES.FLOOR;
                        }
                    }
                }
                break;
            case 2: // Bottom - corridor goes down
                for (let y = doorY; y <= hiddenY; y++) {
                    if (this.isInBounds(corridorX, y)) {
                        if (y === doorY) {
                            // Keep as breakable wall
                        } else {
                            this.tiles[y][corridorX] = this.TILES.FLOOR;
                        }
                    }
                }
                break;
            case 3: // Left - corridor goes left
                for (let x = doorX; x >= hiddenX + width - 1; x--) {
                    if (this.isInBounds(x, corridorY)) {
                        if (x === doorX) {
                            // Keep as breakable wall
                        } else {
                            this.tiles[corridorY][x] = this.TILES.FLOOR;
                        }
                    }
                }
                break;
        }
        
        // Place treasure in hidden room
        const centerX = hiddenX + Math.floor(width / 2);
        const centerY = hiddenY + Math.floor(height / 2);
        
        // Always place a chest in hidden rooms
        if (this.isInBounds(centerX, centerY)) {
            this.tiles[centerY][centerX] = this.TILES.CHEST;
        }
        
        // Sometimes add an extra chest
        if (Math.random() < 0.3 + floor * 0.05) {
            const extraX = hiddenX + Utils.randomInt(1, width - 2);
            const extraY = hiddenY + Utils.randomInt(1, height - 2);
            if (this.tiles[extraY][extraX] === this.TILES.FLOOR) {
                this.tiles[extraY][extraX] = this.TILES.CHEST;
            }
        }
        
        const hiddenRoom = {
            x: hiddenX,
            y: hiddenY,
            width: width,
            height: height,
            centerX: centerX,
            centerY: centerY,
            parentRoom: parentRoom,
            entranceX: doorX,
            entranceY: doorY,
            isHidden: true,
            isRevealed: false
        };
        
        // Add to rooms array so spawn points can be generated
        this.rooms.push(hiddenRoom);
        
        return hiddenRoom;
    }
    
    placeTorchesAndCore(floor) {
        // Need at least 3 rooms: start, boss room, and at least 1 other room
        if (this.rooms.length < 3) return;
        
        // Core now spawns in the BOSS ROOM (the large 50x50 room)
        // This makes the boss fight more climactic as players must defeat
        // the core guardian to progress
        
        if (!this.bossRoom) return;
        
        // The boss room IS the core room now
        this.coreRoom = this.bossRoom;
        
        // Place large dungeon core (4x4 tiles) in center of boss room
        // This creates an imposing central structure
        const coreSize = 4; // 4 tiles wide = 128 pixels
        const coreCenterX = this.coreRoom.centerX;
        const coreCenterY = this.coreRoom.centerY;
        
        // Store core position (center tile for interaction)
        this.corePosition = {
            x: coreCenterX,
            y: coreCenterY,
            size: coreSize // Store size for rendering
        };
        
        // Place DUNGEON_CORE tiles in a 4x4 grid pattern
        const halfSize = Math.floor(coreSize / 2);
        for (let dy = -halfSize; dy < halfSize; dy++) {
            for (let dx = -halfSize; dx < halfSize; dx++) {
                const tileX = coreCenterX + dx;
                const tileY = coreCenterY + dy;
                if (this.isInBounds(tileX, tileY)) {
                    this.tiles[tileY][tileX] = this.TILES.DUNGEON_CORE;
                }
            }
        }
        
        // No torches or locked doors - core is directly accessible
        // Boss spawns when player activates the core
        this.torchPositions = [];
        this.coreDoorPosition = null;
    }
    
    isAtRoomEdge(x, y, room) {
        return (x === room.x || x === room.x + room.width - 1 ||
                y === room.y || y === room.y + room.height - 1) &&
               x >= room.x && x < room.x + room.width &&
               y >= room.y && y < room.y + room.height;
    }
    
    // Expand the core room to meet minimum size requirements
    expandCoreRoom(minWidth, minHeight) {
        if (!this.coreRoom) return;
        
        const room = this.coreRoom;
        const expandX = Math.max(0, Math.ceil((minWidth - room.width) / 2));
        const expandY = Math.max(0, Math.ceil((minHeight - room.height) / 2));
        
        // Calculate new bounds (clamped to map edges)
        const newX = Math.max(1, room.x - expandX);
        const newY = Math.max(1, room.y - expandY);
        const newWidth = Math.min(this.width - newX - 1, room.width + expandX * 2);
        const newHeight = Math.min(this.height - newY - 1, room.height + expandY * 2);
        
        // Carve out the expanded area as floor
        for (let y = newY; y < newY + newHeight; y++) {
            for (let x = newX; x < newX + newWidth; x++) {
                if (y === newY || y === newY + newHeight - 1 ||
                    x === newX || x === newX + newWidth - 1) {
                    // Don't replace existing floors on edges
                    if (this.tiles[y][x] === this.TILES.VOID) {
                        this.tiles[y][x] = this.TILES.WALL;
                    }
                } else {
                    this.tiles[y][x] = this.TILES.FLOOR;
                }
            }
        }
        
        // Update room dimensions
        room.x = newX;
        room.y = newY;
        room.width = newWidth;
        room.height = newHeight;
        room.centerX = Math.floor(room.x + room.width / 2);
        room.centerY = Math.floor(room.y + room.height / 2);
    }
    
    // Find all entrance points to a room (where floor meets room edge)
    findRoomEntrances(room) {
        const entrances = [];
        
        // Check all edge tiles
        // Top edge
        for (let x = room.x; x < room.x + room.width; x++) {
            if (room.y > 0 && this.tiles[room.y - 1][x] === this.TILES.FLOOR) {
                entrances.push({ x, y: room.y });
            }
        }
        
        // Bottom edge
        for (let x = room.x; x < room.x + room.width; x++) {
            const bottomY = room.y + room.height - 1;
            if (bottomY < this.height - 1 && this.tiles[bottomY + 1][x] === this.TILES.FLOOR) {
                entrances.push({ x, y: bottomY });
            }
        }
        
        // Left edge
        for (let y = room.y; y < room.y + room.height; y++) {
            if (room.x > 0 && this.tiles[y][room.x - 1] === this.TILES.FLOOR) {
                entrances.push({ x: room.x, y });
            }
        }
        
        // Right edge
        for (let y = room.y; y < room.y + room.height; y++) {
            const rightX = room.x + room.width - 1;
            if (rightX < this.width - 1 && this.tiles[y][rightX + 1] === this.TILES.FLOOR) {
                entrances.push({ x: rightX, y });
            }
        }
        
        return entrances;
    }
    
    generateSpawnPoints(floor) {
        const baseEnemies = 3 + floor * 2;
        
        console.log(`Generating spawn points for floor ${floor} with ${this.rooms.length} rooms`);
        
        // Player spawn in start room - NEVER in boss room or core room
        if (this.startRoom && this.startRoom !== this.bossRoom && this.startRoom !== this.coreRoom) {
            this.spawnPoints.push({
                x: this.startRoom.centerX,
                y: this.startRoom.centerY + 1,
                type: 'player',
                room: this.startRoom
            });
        } else {
            // Fallback: find a safe room that isn't boss or core room
            const safeRoom = this.rooms.find(r => r !== this.bossRoom && r !== this.coreRoom);
            if (safeRoom) {
                this.startRoom = safeRoom;
                this.spawnPoints.push({
                    x: safeRoom.centerX,
                    y: safeRoom.centerY + 1,
                    type: 'player',
                    room: safeRoom
                });
            }
        }
        
        let totalEnemySpawns = 0;
        for (const room of this.rooms) {
            // Skip start room and core room for enemy spawns (core room has its own boss spawning logic)
            if (room === this.startRoom || room === this.coreRoom) continue;
            
            const isBossRoom = room === this.bossRoom;
            const enemyCount = isBossRoom ? 1 : Utils.randomInt(2, Math.min(5, baseEnemies));
            
            let spawned = 0;
            let attempts = 0;
            const maxAttempts = enemyCount * 10; // Try harder to place enemies
            
            while (spawned < enemyCount && attempts < maxAttempts) {
                attempts++;
                // Ensure valid spawn range - room must be at least 4 tiles wide/tall for enemies
                const minX = room.x + 1;
                const maxX = room.x + Math.max(1, room.width - 2);
                const minY = room.y + 1;
                const maxY = room.y + Math.max(1, room.height - 2);
                
                const x = Utils.randomInt(minX, maxX);
                const y = Utils.randomInt(minY, maxY);
                
                if (this.isInBounds(x, y) && this.tiles[y][x] === this.TILES.FLOOR) {
                    // Check this spot isn't too close to another spawn
                    const tooClose = this.spawnPoints.some(sp => 
                        Math.abs(sp.x - x) < 2 && Math.abs(sp.y - y) < 2
                    );
                    
                    if (!tooClose) {
                        this.spawnPoints.push({
                            x: x,
                            y: y,
                            type: isBossRoom ? 'boss' : 'enemy',
                            room: room
                        });
                        spawned++;
                        if (!isBossRoom) totalEnemySpawns++;
                    }
                }
            }
        }
        
        console.log(`Generated ${totalEnemySpawns} enemy spawn points`);
    }
    
    isInBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    
    getTile(x, y) {
        if (!this.isInBounds(x, y)) return this.TILES.VOID;
        return this.tiles[y][x];
    }
    
    setTile(x, y, tile) {
        if (this.isInBounds(x, y)) {
            this.tiles[y][x] = tile;
        }
    }
    
    worldToTile(worldX, worldY) {
        return {
            x: Math.floor(worldX / this.tileSize),
            y: Math.floor(worldY / this.tileSize)
        };
    }
    
    tileToWorld(tileX, tileY) {
        return {
            x: tileX * this.tileSize,
            y: tileY * this.tileSize
        };
    }
    
    isWalkable(x, y) {
        const tile = this.getTile(x, y);
        return tile === this.TILES.FLOOR || 
               tile === this.TILES.DOOR || 
               tile === this.TILES.STAIRS_DOWN ||
               tile === this.TILES.STAIRS_UP ||
               tile === this.TILES.TRAP ||
               tile === this.TILES.TORCH_UNLIT ||
               tile === this.TILES.TORCH_LIT ||
               tile === this.TILES.DUNGEON_CORE ||
               tile === this.TILES.CORE_DOOR;
    }
    
    getPlayerSpawn() {
        if (this.startRoom) {
            return {
                x: this.startRoom.centerX * this.tileSize,
                y: (this.startRoom.centerY + 2) * this.tileSize
            };
        }
        return { x: 100, y: 100 };
    }
}

// Dungeon tilemap renderer
export class DungeonRenderer {
    constructor(dungeon = null) {
        this.dungeon = dungeon;
        this.tileSize = dungeon ? dungeon.tileSize : 32;
        
        // Current floor theme (set externally)
        this.floorTheme = null;
        
        // Default tile colors (will be overridden by floor theme)
        this.tileColors = {
            0: '#000000', // VOID
            1: '#3a3a4a', // FLOOR
            2: '#5a5a6a', // WALL
            3: '#6a5a4a', // DOOR
            4: '#4a6a4a', // STAIRS_DOWN
            5: '#6a6a4a', // STAIRS_UP
            6: '#8a7a2a', // CHEST
            7: '#6a3a3a', // TRAP
            8: '#2a3a6a', // WATER
            9: '#8a3a1a', // LAVA
            10: '#3a3a4a', // TORCH_UNLIT (floor base)
            11: '#3a3a4a', // TORCH_LIT (floor base)
            12: '#3a3a4a', // DUNGEON_CORE (floor base)
            13: '#2a2a3a'  // CORE_DOOR (darker locked door)
        };
        
        // Animation timer for glowing effects
        this.animTime = 0;
        
        // Pre-render the dungeon if provided
        this.canvas = null;
        if (dungeon) {
            this.preRender();
        }
    }
    
    // Set floor theme colors
    setFloorTheme(themeColors) {
        if (!themeColors) return;
        
        this.floorTheme = themeColors;
        
        // Update tile colors based on theme
        this.tileColors = {
            0: themeColors.void || '#000000',      // VOID
            1: themeColors.floor || '#3a3a4a',     // FLOOR
            2: themeColors.wall || '#5a5a6a',      // WALL
            3: themeColors.door || '#6a5a4a',      // DOOR
            4: themeColors.accent || '#4a6a4a',    // STAIRS_DOWN
            5: themeColors.accent || '#6a6a4a',    // STAIRS_UP
            6: themeColors.highlight || '#8a7a2a', // CHEST
            7: '#6a3a3a',                          // TRAP (always red-ish)
            8: '#2a3a6a',                          // WATER (always blue)
            9: '#8a3a1a',                          // LAVA (always orange)
            10: themeColors.floor || '#3a3a4a',    // TORCH_UNLIT
            11: themeColors.floor || '#3a3a4a',    // TORCH_LIT
            12: themeColors.floor || '#3a3a4a',    // DUNGEON_CORE
            13: themeColors.door || '#2a2a3a'      // CORE_DOOR
        };
        
        // Re-render if dungeon exists
        if (this.dungeon) {
            this.preRender();
        }
    }
    
    setDungeon(dungeon) {
        this.dungeon = dungeon;
        this.tileSize = dungeon.tileSize;
        this.preRender();
    }
    
    preRender() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.dungeon.width * this.tileSize;
        this.canvas.height = this.dungeon.height * this.tileSize;
        
        const ctx = this.canvas.getContext('2d');
        
        for (let y = 0; y < this.dungeon.height; y++) {
            for (let x = 0; x < this.dungeon.width; x++) {
                const tile = this.dungeon.tiles[y][x];
                const worldX = x * this.tileSize;
                const worldY = y * this.tileSize;
                
                ctx.fillStyle = this.tileColors[tile] || '#ff00ff';
                ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
                
                // Add details
                this.renderTileDetails(ctx, x, y, tile);
            }
        }
    }
    
    renderTileDetails(ctx, x, y, tile) {
        const worldX = x * this.tileSize;
        const worldY = y * this.tileSize;
        
        if (tile === 1) { // Floor - Earthy grainy texture
            // Single noise value for consistent color variation (not multicolored)
            const noise = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1);
            
            // Earthy brown base - noise affects brightness only, not hue
            const brightness = 45 + Math.floor(noise * 20);
            // Keep brown ratio constant: R slightly higher, G medium, B lower
            const baseR = Math.floor(brightness * 1.3);  // ~60-85
            const baseG = Math.floor(brightness * 1.05); // ~47-68
            const baseB = Math.floor(brightness * 0.85); // ~38-55
            ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
            ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
            
            // Add grainy specks - small dirt particles
            const numSpecks = 4 + Math.floor(noise * 4);
            for (let i = 0; i < numSpecks; i++) {
                const speckNoise = Math.abs(Math.sin((x + i) * 23.14 + (y + i) * 57.29) % 1);
                const sx = worldX + speckNoise * this.tileSize * 0.9 + 1;
                const sy = worldY + Math.abs(Math.cos((x + i) * 31.7 + y * 19.3) % 1) * this.tileSize * 0.9 + 1;
                const speckSize = 1 + speckNoise * 1.5;
                
                // Darker or lighter brown specks (not white/black)
                if (speckNoise > 0.5) {
                    // Darker brown speck
                    ctx.fillStyle = `rgba(${baseR - 20}, ${baseG - 15}, ${baseB - 10}, 0.3)`;
                } else {
                    // Lighter tan speck
                    ctx.fillStyle = `rgba(${baseR + 15}, ${baseG + 10}, ${baseB + 5}, 0.25)`;
                }
                ctx.fillRect(sx, sy, speckSize, speckSize);
            }
            
            // Subtle texture lines (like packed dirt)
            if (noise > 0.6) {
                const lineNoise = Math.sin(x * 7.5 + y * 13.2) % 1;
                ctx.strokeStyle = `rgba(${baseR - 15}, ${baseG - 12}, ${baseB - 8}, 0.15)`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(worldX + Math.abs(lineNoise) * this.tileSize * 0.3, worldY + 2);
                ctx.lineTo(worldX + this.tileSize * 0.7 + Math.abs(lineNoise) * 8, worldY + this.tileSize - 2);
                ctx.stroke();
            }
        } else if (tile === 2) { // Wall
            // Add brick-like pattern
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            
            const brickHeight = this.tileSize / 2;
            for (let i = 0; i < 2; i++) {
                const by = worldY + i * brickHeight;
                ctx.beginPath();
                ctx.moveTo(worldX, by);
                ctx.lineTo(worldX + this.tileSize, by);
                ctx.stroke();
            }
            
            const offset = y % 2 === 0 ? 0 : this.tileSize / 2;
            ctx.beginPath();
            ctx.moveTo(worldX + offset, worldY);
            ctx.lineTo(worldX + offset, worldY + this.tileSize);
            ctx.stroke();
        } else if (tile === 4) { // Stairs down
            ctx.fillStyle = '#2a4a2a';
            for (let i = 0; i < 4; i++) {
                const sw = this.tileSize * (1 - i * 0.2);
                const sh = this.tileSize * (1 - i * 0.2);
                ctx.fillRect(
                    worldX + (this.tileSize - sw) / 2,
                    worldY + (this.tileSize - sh) / 2,
                    sw, sh
                );
            }
        } else if (tile === 5) { // Stairs up
            ctx.fillStyle = '#4a4a2a';
            for (let i = 0; i < 4; i++) {
                const sw = this.tileSize * (0.2 + i * 0.2);
                const sh = this.tileSize * (0.2 + i * 0.2);
                ctx.fillRect(
                    worldX + (this.tileSize - sw) / 2,
                    worldY + (this.tileSize - sh) / 2,
                    sw, sh
                );
            }
        } else if (tile === 6) { // Chest - Ornate treasure chest
            // First, draw floor texture underneath (so no background color shows)
            const noise = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1);
            const brightness = 45 + Math.floor(noise * 20);
            const baseR = Math.floor(brightness * 1.3);
            const baseG = Math.floor(brightness * 1.05);
            const baseB = Math.floor(brightness * 0.85);
            ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
            ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
            
            const cx = worldX + this.tileSize / 2;
            const cy = worldY + this.tileSize / 2 + 2;
            const cw = this.tileSize * 0.75;
            const ch = this.tileSize * 0.55;
            
            // Shadow under chest
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + ch/2 + 3, cw/2, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Chest base (3D perspective)
            ctx.fillStyle = '#4a3518';
            ctx.beginPath();
            ctx.moveTo(cx - cw/2, cy + ch/2);
            ctx.lineTo(cx - cw/2 + 3, cy + ch/2 + 4);
            ctx.lineTo(cx + cw/2 - 3, cy + ch/2 + 4);
            ctx.lineTo(cx + cw/2, cy + ch/2);
            ctx.closePath();
            ctx.fill();
            
            // Main chest body with wood grain
            const woodGrad = ctx.createLinearGradient(cx - cw/2, cy, cx + cw/2, cy);
            woodGrad.addColorStop(0, '#5a3d1a');
            woodGrad.addColorStop(0.2, '#6b4a22');
            woodGrad.addColorStop(0.5, '#7a5830');
            woodGrad.addColorStop(0.8, '#6b4a22');
            woodGrad.addColorStop(1, '#5a3d1a');
            ctx.fillStyle = woodGrad;
            ctx.fillRect(cx - cw/2, cy - ch/4, cw, ch * 0.7);
            
            // Wood grain lines
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(cx - cw/2 + 4, cy - ch/4 + i * ch * 0.2 + 4);
                ctx.quadraticCurveTo(cx, cy - ch/4 + i * ch * 0.2 + 6, cx + cw/2 - 4, cy - ch/4 + i * ch * 0.2 + 3);
                ctx.stroke();
            }
            
            // Domed lid
            ctx.fillStyle = '#6b4a22';
            ctx.beginPath();
            ctx.ellipse(cx, cy - ch/4, cw/2, ch * 0.35, 0, Math.PI, 0);
            ctx.fill();
            
            // Lid top highlight
            ctx.fillStyle = '#8a6538';
            ctx.beginPath();
            ctx.ellipse(cx - 3, cy - ch/4 - ch * 0.15, cw * 0.25, ch * 0.12, -0.3, 0, Math.PI * 2);
            ctx.fill();
            
            // Metal corner reinforcements
            ctx.fillStyle = '#c9a227';
            ctx.fillRect(cx - cw/2, cy - ch/4, 5, ch * 0.7);
            ctx.fillRect(cx + cw/2 - 5, cy - ch/4, 5, ch * 0.7);
            
            // Metal band across front
            ctx.fillStyle = '#b8922a';
            ctx.fillRect(cx - cw/2, cy + ch * 0.2, cw, 4);
            
            // Ornate lock plate
            ctx.fillStyle = '#d4af37';
            ctx.beginPath();
            ctx.arc(cx, cy + ch * 0.22, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Keyhole
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(cx, cy + ch * 0.2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(cx - 1, cy + ch * 0.2, 2, 4);
            
            // Gem on lock
            ctx.fillStyle = '#ff3333';
            ctx.beginPath();
            ctx.arc(cx, cy + ch * 0.1, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(cx - 1, cy + ch * 0.08, 1, 0, Math.PI * 2);
            ctx.fill();
            
            // Lid metal trim
            ctx.strokeStyle = '#c9a227';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy - ch/4, cw/2 - 1, ch * 0.33, 0, Math.PI, 0);
            ctx.stroke();
            
            // Highlight glint on lid
            ctx.fillStyle = 'rgba(255, 255, 200, 0.4)';
            ctx.beginPath();
            ctx.ellipse(cx - cw * 0.2, cy - ch * 0.35, cw * 0.15, ch * 0.08, -0.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (tile === 7) { // Trapped chest - looks like a normal chest but slightly different
            // Draw floor underneath first
            const noise = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1);
            const brightness = 45 + Math.floor(noise * 20);
            const baseR = Math.floor(brightness * 1.3);
            const baseG = Math.floor(brightness * 1.05);
            const baseB = Math.floor(brightness * 0.85);
            ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
            ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
            
            const cx = worldX + this.tileSize / 2;
            const cy = worldY + this.tileSize / 2;
            const cw = this.tileSize * 0.7;
            const ch = this.tileSize * 0.55;
            
            // Chest shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + ch/2 + 2, cw/2 + 2, ch * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Chest body (slightly darker brown - suspicious)
            ctx.fillStyle = '#6a4a2a';
            ctx.fillRect(cx - cw/2, cy - ch/4, cw, ch * 0.7);
            
            // Chest front metal band
            ctx.fillStyle = '#705030';
            ctx.fillRect(cx - cw/2 + 2, cy - ch/4 + ch * 0.25, cw - 4, ch * 0.15);
            
            // Chest lid (curved top)
            ctx.fillStyle = '#7a5a3a';
            ctx.beginPath();
            ctx.ellipse(cx, cy - ch/4, cw/2, ch * 0.35, 0, Math.PI, 0);
            ctx.fill();
            
            // Lid outline
            ctx.strokeStyle = '#4a3a20';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(cx, cy - ch/4, cw/2, ch * 0.35, 0, Math.PI, 0);
            ctx.stroke();
            
            // Keyhole (slightly sinister red glow)
            ctx.fillStyle = '#8a2020';
            ctx.beginPath();
            ctx.arc(cx, cy + ch * 0.05, cw * 0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(cx - cw * 0.03, cy + ch * 0.05, cw * 0.06, ch * 0.15);
        } else if (tile === 10) { // TORCH_UNLIT - Iron wall sconce
            // First, draw floor texture underneath (so no background color shows)
            const noise = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1);
            const brightness = 45 + Math.floor(noise * 20);
            const baseR = Math.floor(brightness * 1.3);
            const baseG = Math.floor(brightness * 1.05);
            const baseB = Math.floor(brightness * 0.85);
            ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
            ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
            
            const tx = worldX + this.tileSize / 2;
            const ty = worldY + this.tileSize / 2;
            
            // Shadow under sconce
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.ellipse(tx, ty + this.tileSize * 0.38, this.tileSize * 0.2, this.tileSize * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Wall bracket (iron)
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(tx - 3, ty - this.tileSize * 0.1, 6, this.tileSize * 0.35);
            
            // Bracket rivets
            ctx.fillStyle = '#4a4a4a';
            ctx.beginPath();
            ctx.arc(tx, ty - this.tileSize * 0.05, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tx, ty + this.tileSize * 0.15, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Torch holder cup
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.moveTo(tx - this.tileSize * 0.2, ty + this.tileSize * 0.25);
            ctx.lineTo(tx - this.tileSize * 0.15, ty + this.tileSize * 0.4);
            ctx.lineTo(tx + this.tileSize * 0.15, ty + this.tileSize * 0.4);
            ctx.lineTo(tx + this.tileSize * 0.2, ty + this.tileSize * 0.25);
            ctx.closePath();
            ctx.fill();
            
            // Cup rim
            ctx.strokeStyle = '#5a5a5a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx - this.tileSize * 0.2, ty + this.tileSize * 0.25);
            ctx.lineTo(tx + this.tileSize * 0.2, ty + this.tileSize * 0.25);
            ctx.stroke();
            
            // Torch stick (unlit)
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(tx - 4, ty - this.tileSize * 0.35, 8, this.tileSize * 0.6);
            
            // Charred top
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(tx, ty - this.tileSize * 0.35, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Wood grain on stick
            ctx.strokeStyle = '#3a2a1a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tx - 2, ty - this.tileSize * 0.2);
            ctx.lineTo(tx - 2, ty + this.tileSize * 0.15);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(tx + 2, ty - this.tileSize * 0.15);
            ctx.lineTo(tx + 2, ty + this.tileSize * 0.1);
            ctx.stroke();
            
        } else if (tile === 11) { // TORCH_LIT - Iron wall sconce with flames
            // First, draw floor texture underneath (so no background color shows)
            const noise = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1);
            const brightness = 45 + Math.floor(noise * 20);
            const baseR = Math.floor(brightness * 1.3);
            const baseG = Math.floor(brightness * 1.05);
            const baseB = Math.floor(brightness * 0.85);
            ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
            ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
            
            const tx = worldX + this.tileSize / 2;
            const ty = worldY + this.tileSize / 2;
            const time = Date.now() / 100;
            
            // Dynamic shadow (flickers with flame)
            const shadowFlicker = 0.5 + Math.sin(time * 2) * 0.1;
            ctx.fillStyle = `rgba(0, 0, 0, ${shadowFlicker})`;
            ctx.beginPath();
            ctx.ellipse(tx, ty + this.tileSize * 0.38, this.tileSize * 0.22, this.tileSize * 0.09, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Fire glow on wall/ground
            const glowRadius = this.tileSize * 0.8 + Math.sin(time * 1.3) * 4;
            const glowGradient = ctx.createRadialGradient(tx, ty - this.tileSize * 0.2, 0, tx, ty - this.tileSize * 0.2, glowRadius);
            glowGradient.addColorStop(0, 'rgba(255, 120, 30, 0.35)');
            glowGradient.addColorStop(0.5, 'rgba(255, 80, 0, 0.15)');
            glowGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(tx, ty - this.tileSize * 0.2, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Wall bracket (iron, lit by fire)
            ctx.fillStyle = '#3a3030';
            ctx.fillRect(tx - 3, ty - this.tileSize * 0.1, 6, this.tileSize * 0.35);
            
            // Bracket rivets (glowing slightly)
            ctx.fillStyle = '#5a4a4a';
            ctx.beginPath();
            ctx.arc(tx, ty - this.tileSize * 0.05, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tx, ty + this.tileSize * 0.15, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Torch holder cup (lit by fire)
            ctx.fillStyle = '#4a3a3a';
            ctx.beginPath();
            ctx.moveTo(tx - this.tileSize * 0.2, ty + this.tileSize * 0.25);
            ctx.lineTo(tx - this.tileSize * 0.15, ty + this.tileSize * 0.4);
            ctx.lineTo(tx + this.tileSize * 0.15, ty + this.tileSize * 0.4);
            ctx.lineTo(tx + this.tileSize * 0.2, ty + this.tileSize * 0.25);
            ctx.closePath();
            ctx.fill();
            
            // Cup rim highlight from fire
            ctx.strokeStyle = '#7a5a4a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx - this.tileSize * 0.2, ty + this.tileSize * 0.25);
            ctx.lineTo(tx + this.tileSize * 0.2, ty + this.tileSize * 0.25);
            ctx.stroke();
            
            // Torch stick
            ctx.fillStyle = '#5a4530';
            ctx.fillRect(tx - 4, ty - this.tileSize * 0.2, 8, this.tileSize * 0.45);
            
            // Burning wrap at top
            ctx.fillStyle = '#2a1a0a';
            ctx.fillRect(tx - 5, ty - this.tileSize * 0.25, 10, this.tileSize * 0.12);
            
            // Ember glow on wrap
            ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
            ctx.fillRect(tx - 4, ty - this.tileSize * 0.23, 8, this.tileSize * 0.08);
            
            // Main flame (animated multi-layer)
            const flameHeight = this.tileSize * 0.45 + Math.sin(time * 1.7) * 4;
            const flameWobble = Math.sin(time * 2.3) * 2;
            
            // Outer flame (deep orange/red)
            ctx.fillStyle = '#ff4400';
            ctx.beginPath();
            ctx.moveTo(tx - this.tileSize * 0.18, ty - this.tileSize * 0.25);
            ctx.quadraticCurveTo(tx - this.tileSize * 0.12 + flameWobble, ty - flameHeight * 0.6, tx + flameWobble, ty - flameHeight);
            ctx.quadraticCurveTo(tx + this.tileSize * 0.12 + flameWobble, ty - flameHeight * 0.6, tx + this.tileSize * 0.18, ty - this.tileSize * 0.25);
            ctx.fill();
            
            // Middle flame (orange)
            ctx.fillStyle = '#ff7700';
            ctx.beginPath();
            ctx.moveTo(tx - this.tileSize * 0.12, ty - this.tileSize * 0.25);
            ctx.quadraticCurveTo(tx - this.tileSize * 0.06 + flameWobble * 0.7, ty - flameHeight * 0.5, tx + flameWobble * 0.5, ty - flameHeight * 0.85);
            ctx.quadraticCurveTo(tx + this.tileSize * 0.06 + flameWobble * 0.7, ty - flameHeight * 0.5, tx + this.tileSize * 0.12, ty - this.tileSize * 0.25);
            ctx.fill();
            
            // Inner flame (yellow)
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(tx - this.tileSize * 0.06, ty - this.tileSize * 0.25);
            ctx.quadraticCurveTo(tx + flameWobble * 0.3, ty - flameHeight * 0.4, tx + flameWobble * 0.3, ty - flameHeight * 0.7);
            ctx.quadraticCurveTo(tx + flameWobble * 0.3, ty - flameHeight * 0.4, tx + this.tileSize * 0.06, ty - this.tileSize * 0.25);
            ctx.fill();
            
            // Core flame (white-yellow)
            ctx.fillStyle = '#ffdd44';
            ctx.beginPath();
            ctx.moveTo(tx - 2, ty - this.tileSize * 0.25);
            ctx.quadraticCurveTo(tx, ty - flameHeight * 0.35, tx, ty - flameHeight * 0.55);
            ctx.quadraticCurveTo(tx, ty - flameHeight * 0.35, tx + 2, ty - this.tileSize * 0.25);
            ctx.fill();
            
            // Sparks (randomly positioned based on time)
            ctx.fillStyle = '#ffcc00';
            for (let i = 0; i < 3; i++) {
                const sparkTime = time + i * 47;
                const sparkX = tx + Math.sin(sparkTime * 0.7) * this.tileSize * 0.15;
                const sparkY = ty - this.tileSize * 0.3 - (sparkTime % 20) * 1.5;
                const sparkAlpha = 1 - ((sparkTime % 20) / 20);
                if (sparkAlpha > 0) {
                    ctx.globalAlpha = sparkAlpha;
                    ctx.beginPath();
                    ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
        } else if (tile === 12) { // DUNGEON_CORE - Crystalline Heart
            // Draw distinctive floor for all core tiles
            const time = Date.now() / 1000;
            const noise = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1);
            
            // Dark crystalline floor base
            const pulse = 0.7 + Math.sin(time * 2 + noise * 3) * 0.2;
            const brightness = 30 + Math.floor(noise * 15);
            ctx.fillStyle = `rgb(${brightness + 20}, ${brightness}, ${brightness + 30})`;
            ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
            
            // Add glowing vein pattern on all core tiles
            ctx.strokeStyle = `rgba(200, 80, 120, ${0.4 + Math.sin(time * 3 + x + y) * 0.2})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(worldX, worldY + this.tileSize/2);
            ctx.lineTo(worldX + this.tileSize/2, worldY + this.tileSize/2 + Math.sin(time + x) * 4);
            ctx.lineTo(worldX + this.tileSize, worldY + this.tileSize/2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(worldX + this.tileSize/2, worldY);
            ctx.lineTo(worldX + this.tileSize/2 + Math.sin(time + y) * 4, worldY + this.tileSize/2);
            ctx.lineTo(worldX + this.tileSize/2, worldY + this.tileSize);
            ctx.stroke();
            
            // Glowing particles on core tiles
            const particleCount = 2;
            for (let p = 0; p < particleCount; p++) {
                const px = worldX + Math.abs(Math.sin(time + p + x * 0.3) * this.tileSize * 0.8) + 2;
                const py = worldY + Math.abs(Math.cos(time + p + y * 0.3) * this.tileSize * 0.8) + 2;
                const pSize = 2 + Math.sin(time * 3 + p) * 1;
                ctx.fillStyle = `rgba(255, 150, 180, ${0.5 + Math.sin(time * 4 + p) * 0.3})`;
                ctx.beginPath();
                ctx.arc(px, py, pSize, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Check if this is the center tile of the core
            const tileX = x;
            const tileY = y;
            
            const coreTiles = this.dungeon?.corePosition;
            if (coreTiles && coreTiles.size) {
                const halfSize = Math.floor(coreTiles.size / 2);
                const isTopLeft = (tileX === coreTiles.x - halfSize && tileY === coreTiles.y - halfSize);
                
                if (isTopLeft) {
                    const coreWorldX = worldX + this.tileSize * 2;
                    const coreWorldY = worldY + this.tileSize * 2;
                    const coreRadius = this.tileSize * 2.2;
                    const time = Date.now() / 1000;
                    
                    // Pulsing glow on ground
                    const pulse = 0.7 + Math.sin(time * 2) * 0.3;
                    const groundGlow = ctx.createRadialGradient(
                        coreWorldX, coreWorldY + coreRadius * 0.6,
                        0,
                        coreWorldX, coreWorldY + coreRadius * 0.6,
                        coreRadius * 2 * pulse
                    );
                    groundGlow.addColorStop(0, 'rgba(180, 60, 80, 0.4)');
                    groundGlow.addColorStop(0.5, 'rgba(120, 40, 60, 0.2)');
                    groundGlow.addColorStop(1, 'rgba(80, 20, 40, 0)');
                    ctx.fillStyle = groundGlow;
                    ctx.beginPath();
                    ctx.ellipse(coreWorldX, coreWorldY + coreRadius * 0.6, coreRadius * 2 * pulse, coreRadius * 0.8 * pulse, 0, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Dark tendril veins reaching out
                    ctx.strokeStyle = 'rgba(60, 20, 30, 0.5)';
                    ctx.lineWidth = 3;
                    for (let v = 0; v < 8; v++) {
                        const veinAngle = (v / 8) * Math.PI * 2;
                        const veinLen = coreRadius * (1.5 + Math.sin(time + v * 0.5) * 0.3);
                        ctx.beginPath();
                        ctx.moveTo(coreWorldX, coreWorldY);
                        for (let seg = 1; seg <= 4; seg++) {
                            const segRatio = seg / 4;
                            const wobble = Math.sin(time * 2 + v + seg) * 8;
                            ctx.lineTo(
                                coreWorldX + Math.cos(veinAngle) * veinLen * segRatio + wobble,
                                coreWorldY + Math.sin(veinAngle) * veinLen * segRatio * 0.5 + coreRadius * 0.5 * segRatio
                            );
                        }
                        ctx.stroke();
                    }
                    
                    // Core crystal shape (hexagonal prism effect)
                    ctx.save();
                    
                    // Outer crystal glow
                    const crystalGlow = ctx.createRadialGradient(
                        coreWorldX, coreWorldY - coreRadius * 0.2,
                        coreRadius * 0.3,
                        coreWorldX, coreWorldY - coreRadius * 0.2,
                        coreRadius * 1.3
                    );
                    crystalGlow.addColorStop(0, 'rgba(200, 80, 100, 0.6)');
                    crystalGlow.addColorStop(0.6, 'rgba(150, 40, 60, 0.3)');
                    crystalGlow.addColorStop(1, 'rgba(100, 20, 40, 0)');
                    ctx.fillStyle = crystalGlow;
                    ctx.beginPath();
                    ctx.arc(coreWorldX, coreWorldY - coreRadius * 0.2, coreRadius * 1.3, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Crystal facets (hexagonal shape)
                    const facetPoints = [];
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
                        facetPoints.push({
                            x: coreWorldX + Math.cos(angle) * coreRadius * 0.9,
                            y: coreWorldY - coreRadius * 0.2 + Math.sin(angle) * coreRadius * 0.6
                        });
                    }
                    
                    // Dark crystal body
                    ctx.fillStyle = '#2a1520';
                    ctx.beginPath();
                    ctx.moveTo(facetPoints[0].x, facetPoints[0].y);
                    for (let i = 1; i < 6; i++) {
                        ctx.lineTo(facetPoints[i].x, facetPoints[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                    
                    // Crystal facet highlights
                    for (let i = 0; i < 3; i++) {
                        const brightness = 60 + i * 20;
                        ctx.fillStyle = `rgba(${brightness + 100}, ${brightness}, ${brightness + 20}, 0.4)`;
                        ctx.beginPath();
                        ctx.moveTo(coreWorldX, coreWorldY - coreRadius * 0.2);
                        ctx.lineTo(facetPoints[i].x, facetPoints[i].y);
                        ctx.lineTo(facetPoints[(i + 1) % 6].x, facetPoints[(i + 1) % 6].y);
                        ctx.closePath();
                        ctx.fill();
                    }
                    
                    // Pulsing inner core
                    const innerPulse = 0.6 + Math.sin(time * 3) * 0.2;
                    const innerGlow = ctx.createRadialGradient(
                        coreWorldX, coreWorldY - coreRadius * 0.2,
                        0,
                        coreWorldX, coreWorldY - coreRadius * 0.2,
                        coreRadius * 0.5 * innerPulse
                    );
                    innerGlow.addColorStop(0, 'rgba(255, 150, 180, 0.9)');
                    innerGlow.addColorStop(0.4, 'rgba(200, 80, 100, 0.6)');
                    innerGlow.addColorStop(1, 'rgba(100, 40, 50, 0)');
                    ctx.fillStyle = innerGlow;
                    ctx.beginPath();
                    ctx.arc(coreWorldX, coreWorldY - coreRadius * 0.2, coreRadius * 0.5 * innerPulse, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Energy particles orbiting
                    for (let p = 0; p < 10; p++) {
                        const orbitAngle = (p / 10) * Math.PI * 2 + time * 1.5;
                        const orbitDist = coreRadius * (0.7 + Math.sin(time * 2 + p) * 0.15);
                        const px = coreWorldX + Math.cos(orbitAngle) * orbitDist;
                        const py = coreWorldY - coreRadius * 0.2 + Math.sin(orbitAngle) * orbitDist * 0.5;
                        const pSize = 3 + Math.sin(time * 4 + p) * 1.5;
                        
                        ctx.fillStyle = `rgba(255, 180, 200, ${0.5 + Math.sin(time * 3 + p) * 0.3})`;
                        ctx.beginPath();
                        ctx.arc(px, py, pSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    
                    // Shine/reflection
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.beginPath();
                    ctx.ellipse(coreWorldX - coreRadius * 0.3, coreWorldY - coreRadius * 0.5, coreRadius * 0.15, coreRadius * 0.08, -0.3, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.restore();
                }
            }
        } else if (tile === 13) { // CORE_DOOR (locked)
            // Draw gate bars
            ctx.fillStyle = '#4a3a3a';
            ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
            // Vertical bars
            ctx.fillStyle = '#6a4a4a';
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(
                    worldX + this.tileSize * (0.15 + i * 0.23),
                    worldY + this.tileSize * 0.1,
                    this.tileSize * 0.08,
                    this.tileSize * 0.8
                );
            }
            // Lock symbol
            ctx.fillStyle = '#8a5a2a';
            ctx.beginPath();
            ctx.arc(
                worldX + this.tileSize / 2,
                worldY + this.tileSize / 2,
                this.tileSize * 0.15,
                0, Math.PI * 2
            );
            ctx.fill();
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.arc(
                worldX + this.tileSize / 2,
                worldY + this.tileSize / 2,
                this.tileSize * 0.06,
                0, Math.PI * 2
            );
            ctx.fill();
        }
    }
    
    render(ctx, dungeonOrCamera, cameraArg) {
        // Support both render(ctx, camera) and render(ctx, dungeon, camera)
        let camera;
        if (cameraArg) {
            // Called as render(ctx, dungeon, camera)
            if (!this.dungeon || this.dungeon !== dungeonOrCamera) {
                this.setDungeon(dungeonOrCamera);
            }
            camera = cameraArg;
        } else {
            // Called as render(ctx, camera)
            camera = dungeonOrCamera;
        }
        
        if (!this.dungeon || !this.canvas) {
            return;
        }
        
        // Non-Euclidean rendering: draw dungeon multiple times for seamless wrapping
        const worldW = this.dungeon.width * this.tileSize;
        const worldH = this.dungeon.height * this.tileSize;
        
        // Camera position is already wrapped, so just draw tiles around it
        // We need to draw the world centered on camera position, and copies
        // to fill in when near the edges
        
        const screenW = ctx.canvas.width;
        const screenH = ctx.canvas.height;
        
        // Draw the main copy and adjacent copies for seamless wrapping
        // When camera is near edge of world, adjacent copies fill the gap
        // Use slight overlap (-1 pixel) to prevent any visible seam
        for (let wy = -1; wy <= 1; wy++) {
            for (let wx = -1; wx <= 1; wx++) {
                const drawX = wx * worldW;
                const drawY = wy * worldH;
                
                // Check if this copy would be visible in screen space
                // The camera is at (camera.x, camera.y), and Game.js translates by
                // (-camera.x + screenW/2, -camera.y + screenH/2)
                // So world position (wx, wy) appears at screen position 
                // (wx - camera.x + screenW/2, wy - camera.y + screenH/2)
                
                const screenLeft = drawX - camera.x + screenW / 2;
                const screenRight = screenLeft + worldW;
                const screenTop = drawY - camera.y + screenH / 2;
                const screenBottom = screenTop + worldH;
                
                // Only draw if visible on screen (with small margin for seam overlap)
                if (screenRight > -2 && screenLeft < screenW + 2 &&
                    screenBottom > -2 && screenTop < screenH + 2) {
                    ctx.drawImage(this.canvas, Math.floor(drawX), Math.floor(drawY));
                }
            }
        }
    }
    
    // Render fullscreen minimap
    renderFullscreenMap(ctx, dungeon, playerX, playerY, screenWidth, screenHeight) {
        const padding = 50;
        const mapWidth = screenWidth - padding * 2;
        const mapHeight = screenHeight - padding * 2;
        
        // Calculate scale to fit dungeon
        const scaleX = mapWidth / (dungeon.width * this.tileSize);
        const scaleY = mapHeight / (dungeon.height * this.tileSize);
        const scale = Math.min(scaleX, scaleY);
        
        const actualWidth = dungeon.width * this.tileSize * scale;
        const actualHeight = dungeon.height * this.tileSize * scale;
        const mapX = (screenWidth - actualWidth) / 2;
        const mapY = (screenHeight - actualHeight) / 2;
        
        // Dark background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, screenWidth, screenHeight);
        
        // Map border
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 3;
        ctx.strokeRect(mapX - 5, mapY - 5, actualWidth + 10, actualHeight + 10);
        
        // Draw tiles
        const tileDisplaySize = this.tileSize * scale;
        
        for (let y = 0; y < dungeon.height; y++) {
            for (let x = 0; x < dungeon.width; x++) {
                const key = `${x},${y}`;
                const isDiscovered = dungeon.discoveredTiles.has(key);
                
                const tile = dungeon.tiles[y][x];
                const drawX = mapX + x * tileDisplaySize;
                const drawY = mapY + y * tileDisplaySize;
                
                if (isDiscovered) {
                    // Draw discovered tile
                    ctx.fillStyle = this.tileColors[tile] || '#000';
                    ctx.fillRect(drawX, drawY, tileDisplaySize + 1, tileDisplaySize + 1);
                } else {
                    // Undiscovered - black
                    ctx.fillStyle = '#0a0a0f';
                    ctx.fillRect(drawX, drawY, tileDisplaySize + 1, tileDisplaySize + 1);
                }
            }
        }
        
        // Draw player position (wrapped)
        const wrappedPlayerX = ((playerX % (dungeon.width * this.tileSize)) + (dungeon.width * this.tileSize)) % (dungeon.width * this.tileSize);
        const wrappedPlayerY = ((playerY % (dungeon.height * this.tileSize)) + (dungeon.height * this.tileSize)) % (dungeon.height * this.tileSize);
        
        const playerMapX = mapX + (wrappedPlayerX / this.tileSize) * tileDisplaySize;
        const playerMapY = mapY + (wrappedPlayerY / this.tileSize) * tileDisplaySize;
        
        // Player marker with glow
        ctx.save();
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(playerMapX, playerMapY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('DUNGEON MAP', screenWidth / 2, 35);
        
        ctx.font = '14px Arial';
        ctx.fillStyle = '#888';
        ctx.fillText('Press M to close', screenWidth / 2, screenHeight - 20);
        
        ctx.textAlign = 'left';
    }
    
    // Update a single tile (e.g., when chest is opened)
    updateTile(x, y, newTile) {
        this.dungeon.tiles[y][x] = newTile;
        
        const ctx = this.canvas.getContext('2d');
        const worldX = x * this.tileSize;
        const worldY = y * this.tileSize;
        
        ctx.fillStyle = this.tileColors[newTile] || '#ff00ff';
        ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
        this.renderTileDetails(ctx, x, y, newTile);
    }
}

export default DungeonGenerator;
