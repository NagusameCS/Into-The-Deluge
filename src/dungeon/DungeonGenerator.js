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
    LAVA: 9
};

export class DungeonGenerator {
    constructor(config = {}) {
        this.width = config.width || 80;
        this.height = config.height || 60;
        this.tileSize = config.tileSize || 32;
        this.minRoomSize = config.minRoomSize || 5;
        this.maxRoomSize = config.maxRoomSize || 12;
        this.maxRooms = config.maxRooms || 15;
        this.corridorWidth = config.corridorWidth || 2;
        
        this.tiles = [];
        this.rooms = [];
        this.corridors = [];
        this.spawnPoints = [];
        this.bossRoom = null;
        this.startRoom = null;
        
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
            LAVA: 9
        };
    }
    
    generate(floor = 1) {
        // Initialize with void
        this.tiles = [];
        this.rooms = [];
        this.corridors = [];
        this.spawnPoints = [];
        
        for (let y = 0; y < this.height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.tiles[y][x] = this.TILES.VOID;
            }
        }
        
        // Generate rooms
        this.generateRooms();
        
        // Connect rooms with corridors
        this.connectRooms();
        
        // Add walls around floor tiles
        this.addWalls();
        
        // Place special tiles
        this.placeSpecialTiles(floor);
        
        // Generate spawn points
        this.generateSpawnPoints(floor);
        
        const tiles = this.tiles;
        const width = this.width;
        const height = this.height;
        
        return {
            tiles: tiles,
            rooms: this.rooms,
            corridors: this.corridors,
            spawnPoints: this.spawnPoints,
            startRoom: this.startRoom,
            bossRoom: this.bossRoom,
            width: width,
            height: height,
            tileSize: this.tileSize,
            // Helper method to get tile at position
            getTile(x, y) {
                if (x < 0 || x >= width || y < 0 || y >= height) {
                    return TILE_TYPES.WALL;
                }
                return tiles[y]?.[x] ?? TILE_TYPES.WALL;
            }
        };
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
        
        // Set start and boss rooms
        if (this.rooms.length > 0) {
            this.startRoom = this.rooms[0];
            this.bossRoom = this.rooms[this.rooms.length - 1];
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
        
        // Place traps in corridors (more on deeper floors)
        const trapChance = Math.min(0.15, 0.05 + floor * 0.02);
        for (const corridor of this.corridors) {
            for (const point of corridor.points) {
                if (Math.random() < trapChance && this.tiles[point.y][point.x] === this.TILES.FLOOR) {
                    this.tiles[point.y][point.x] = this.TILES.TRAP;
                }
            }
        }
    }
    
    generateSpawnPoints(floor) {
        const baseEnemies = 3 + floor * 2;
        
        // Player spawn in start room
        if (this.startRoom) {
            this.spawnPoints.push({
                x: this.startRoom.centerX,
                y: this.startRoom.centerY + 1,
                type: 'player',
                room: this.startRoom
            });
        }
        
        for (const room of this.rooms) {
            if (room === this.startRoom) continue;
            
            const isBossRoom = room === this.bossRoom;
            const enemyCount = isBossRoom ? 1 : Utils.randomInt(1, Math.min(4, baseEnemies));
            
            for (let i = 0; i < enemyCount; i++) {
                const x = room.x + Utils.randomInt(1, room.width - 2);
                const y = room.y + Utils.randomInt(1, room.height - 2);
                
                if (this.tiles[y][x] === this.TILES.FLOOR) {
                    this.spawnPoints.push({
                        x: x,
                        y: y,
                        type: isBossRoom ? 'boss' : 'enemy',
                        room: room
                    });
                }
            }
        }
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
               tile === this.TILES.TRAP;
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
        
        // Tile colors
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
            9: '#8a3a1a'  // LAVA
        };
        
        // Pre-render the dungeon if provided
        this.canvas = null;
        if (dungeon) {
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
        
        if (tile === 1) { // Floor
            // Add subtle floor pattern
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            if ((x + y) % 2 === 0) {
                ctx.fillRect(worldX, worldY, this.tileSize, this.tileSize);
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
        } else if (tile === 6) { // Chest
            ctx.fillStyle = '#6a5a2a';
            ctx.fillRect(
                worldX + this.tileSize * 0.2,
                worldY + this.tileSize * 0.3,
                this.tileSize * 0.6,
                this.tileSize * 0.5
            );
            ctx.fillStyle = '#8a7a3a';
            ctx.fillRect(
                worldX + this.tileSize * 0.25,
                worldY + this.tileSize * 0.35,
                this.tileSize * 0.5,
                this.tileSize * 0.15
            );
        } else if (tile === 7) { // Trap
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(
                worldX + this.tileSize / 2,
                worldY + this.tileSize / 2,
                this.tileSize * 0.3,
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
        
        // Draw entire pre-rendered dungeon - camera transform is applied by ctx.translate in Game.js
        ctx.drawImage(this.canvas, 0, 0);
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
