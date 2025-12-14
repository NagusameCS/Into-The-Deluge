/**
 * Puzzle System - 10 unique puzzle types for torch activation
 * Each puzzle is randomized to never be exactly the same
 */

import { Utils } from '../engine/core/Utils.js';

// Base puzzle class
class Puzzle {
    constructor(type) {
        this.type = type;
        this.solved = false;
        this.attempts = 0;
        this.maxAttempts = 3; // Some puzzles have limited attempts
    }
    
    // Override in subclasses
    generate() {}
    checkSolution(input) { return false; }
    getHint() { return ''; }
    render(ctx, x, y, width, height) {}
}

// 1. PATTERN MEMORY - Remember and reproduce a sequence of symbols
export class PatternMemoryPuzzle extends Puzzle {
    constructor() {
        super('pattern_memory');
        this.symbols = ['◆', '◇', '○', '●', '△', '▽', '□', '■', '★', '☆', '♠', '♣', '♥', '♦'];
        this.pattern = [];
        this.patternLength = 5 + Math.floor(Math.random() * 3); // 5-7 symbols
        this.showTime = 3000; // ms to show pattern
        this.currentInput = [];
        this.phase = 'showing'; // 'showing', 'input', 'result'
        this.showStartTime = 0;
        this.selectedSymbols = [];
        this.generate();
    }
    
    generate() {
        // Select 6 random symbols to use
        const shuffled = [...this.symbols].sort(() => Math.random() - 0.5);
        this.selectedSymbols = shuffled.slice(0, 6);
        
        // Generate random pattern
        this.pattern = [];
        for (let i = 0; i < this.patternLength; i++) {
            this.pattern.push(Utils.randomInt(0, 5));
        }
        this.showStartTime = Date.now();
    }
    
    update() {
        if (this.phase === 'showing' && Date.now() - this.showStartTime > this.showTime) {
            this.phase = 'input';
        }
    }
    
    addInput(symbolIndex) {
        if (this.phase !== 'input') return;
        this.currentInput.push(symbolIndex);
        
        // Check if complete
        if (this.currentInput.length === this.pattern.length) {
            this.checkSolution();
        }
    }
    
    checkSolution() {
        const correct = this.currentInput.every((val, idx) => val === this.pattern[idx]);
        if (correct) {
            this.solved = true;
            this.phase = 'result';
        } else {
            this.attempts++;
            this.currentInput = [];
            if (this.attempts >= this.maxAttempts) {
                this.phase = 'failed';
            } else {
                // Show pattern again
                this.phase = 'showing';
                this.showStartTime = Date.now();
            }
        }
        return this.solved;
    }
    
    getHint() {
        return `Remember the sequence of ${this.patternLength} symbols`;
    }
}

// 2. TILE ROTATION - Rotate tiles to form a connected path
export class TileRotationPuzzle extends Puzzle {
    constructor() {
        super('tile_rotation');
        this.gridSize = 4 + Math.floor(Math.random() * 2); // 4x4 or 5x5
        this.tiles = [];
        // Tile types: 0=straight, 1=corner, 2=T-junction, 3=cross
        this.generate();
    }
    
    generate() {
        this.tiles = [];
        // Create a valid path first, then scramble rotations
        for (let y = 0; y < this.gridSize; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                const type = Utils.randomInt(0, 3);
                const rotation = Utils.randomInt(0, 3) * 90; // 0, 90, 180, 270
                this.tiles[y][x] = { type, rotation, correctRotation: 0 };
            }
        }
        
        // Generate a valid solution path and set correct rotations
        this.generateSolutionPath();
        
        // Scramble all rotations
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const scramble = Utils.randomInt(1, 3) * 90;
                this.tiles[y][x].rotation = (this.tiles[y][x].correctRotation + scramble) % 360;
            }
        }
    }
    
    generateSolutionPath() {
        // Simple path from top-left to bottom-right
        let x = 0, y = 0;
        const path = [{x: 0, y: 0}];
        
        while (x < this.gridSize - 1 || y < this.gridSize - 1) {
            if (x < this.gridSize - 1 && (y >= this.gridSize - 1 || Math.random() < 0.5)) {
                x++;
            } else {
                y++;
            }
            path.push({x, y});
        }
        
        // Set tile types based on path
        for (let i = 0; i < path.length; i++) {
            const curr = path[i];
            const prev = path[i - 1];
            const next = path[i + 1];
            
            let connections = [];
            if (prev) connections.push(this.getDirection(curr, prev));
            if (next) connections.push(this.getDirection(curr, next));
            
            // Determine tile type and rotation based on connections
            this.setTileFromConnections(curr.x, curr.y, connections);
        }
    }
    
    getDirection(from, to) {
        if (to.x > from.x) return 'right';
        if (to.x < from.x) return 'left';
        if (to.y > from.y) return 'down';
        return 'up';
    }
    
    setTileFromConnections(x, y, connections) {
        const tile = this.tiles[y][x];
        
        if (connections.length === 1) {
            // End piece - use straight
            tile.type = 0;
            const dir = connections[0];
            tile.correctRotation = dir === 'right' || dir === 'left' ? 0 : 90;
        } else if (connections.length === 2) {
            const [a, b] = connections;
            if ((a === 'left' && b === 'right') || (a === 'right' && b === 'left')) {
                tile.type = 0;
                tile.correctRotation = 0;
            } else if ((a === 'up' && b === 'down') || (a === 'down' && b === 'up')) {
                tile.type = 0;
                tile.correctRotation = 90;
            } else {
                // Corner
                tile.type = 1;
                if ((a === 'up' && b === 'right') || (b === 'up' && a === 'right')) tile.correctRotation = 0;
                else if ((a === 'right' && b === 'down') || (b === 'right' && a === 'down')) tile.correctRotation = 90;
                else if ((a === 'down' && b === 'left') || (b === 'down' && a === 'left')) tile.correctRotation = 180;
                else tile.correctRotation = 270;
            }
        }
    }
    
    rotateTile(x, y) {
        if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
            this.tiles[y][x].rotation = (this.tiles[y][x].rotation + 90) % 360;
            this.checkSolution();
        }
    }
    
    checkSolution() {
        // Check if path is connected from start to end
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const tile = this.tiles[y][x];
                if (tile.rotation !== tile.correctRotation) {
                    return false;
                }
            }
        }
        this.solved = true;
        return true;
    }
    
    getHint() {
        return 'Rotate tiles to connect the path from start to end';
    }
}

// 3. SIMON SAYS - Watch lights flash, repeat the sequence
export class SimonSaysPuzzle extends Puzzle {
    constructor() {
        super('simon_says');
        this.colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];
        this.sequence = [];
        this.sequenceLength = 6 + Math.floor(Math.random() * 4); // 6-9
        this.currentStep = 0;
        this.playerSequence = [];
        this.phase = 'showing'; // 'showing', 'input'
        this.showIndex = 0;
        this.lastFlashTime = 0;
        this.flashDuration = 500;
        this.activeButton = -1;
        this.generate();
    }
    
    generate() {
        this.sequence = [];
        for (let i = 0; i < this.sequenceLength; i++) {
            this.sequence.push(Utils.randomInt(0, 3));
        }
        this.lastFlashTime = Date.now();
    }
    
    update() {
        const now = Date.now();
        if (this.phase === 'showing') {
            if (now - this.lastFlashTime > this.flashDuration) {
                this.showIndex++;
                this.lastFlashTime = now;
                
                if (this.showIndex <= this.sequence.length) {
                    this.activeButton = this.sequence[this.showIndex - 1];
                } else {
                    this.activeButton = -1;
                    this.phase = 'input';
                    this.playerSequence = [];
                }
            } else if (now - this.lastFlashTime > this.flashDuration * 0.7) {
                this.activeButton = -1;
            }
        }
    }
    
    pressButton(index) {
        if (this.phase !== 'input') return;
        
        this.playerSequence.push(index);
        this.activeButton = index;
        setTimeout(() => this.activeButton = -1, 150);
        
        // Check current input
        const stepIndex = this.playerSequence.length - 1;
        if (this.playerSequence[stepIndex] !== this.sequence[stepIndex]) {
            this.attempts++;
            if (this.attempts >= this.maxAttempts) {
                this.phase = 'failed';
            } else {
                // Restart sequence
                this.phase = 'showing';
                this.showIndex = 0;
                this.playerSequence = [];
                this.lastFlashTime = Date.now();
            }
            return;
        }
        
        // Check if complete
        if (this.playerSequence.length === this.sequence.length) {
            this.solved = true;
            this.phase = 'result';
        }
    }
    
    getHint() {
        return `Watch the ${this.sequenceLength} light sequence and repeat it`;
    }
}

// 4. WORD SCRAMBLE - Unscramble an ancient word
export class WordScramblePuzzle extends Puzzle {
    constructor() {
        super('word_scramble');
        this.words = [
            'ANCIENT', 'CRYSTAL', 'DUNGEON', 'ETERNAL', 'PHANTOM',
            'SHADOWS', 'TEMPEST', 'WHISPER', 'ARCANE', 'MYSTIC',
            'ECLIPSE', 'THUNDER', 'CRIMSON', 'TWILIGHT', 'DRAGON',
            'SORCERY', 'ENCHANT', 'CURSED', 'BLESSED', 'INFERNO',
            'GLACIER', 'VORTEX', 'SPECTRE', 'MALICE', 'VIRTUE'
        ];
        this.word = '';
        this.scrambled = '';
        this.currentGuess = '';
        this.letterPositions = [];
        this.generate();
    }
    
    generate() {
        this.word = Utils.randomChoice(this.words);
        this.scrambled = this.scrambleWord(this.word);
        this.letterPositions = this.scrambled.split('').map((letter, i) => ({
            letter,
            originalIndex: i,
            selected: false
        }));
        this.currentGuess = '';
    }
    
    scrambleWord(word) {
        let scrambled = word;
        // Keep scrambling until it's different from original
        while (scrambled === word) {
            scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
        }
        return scrambled;
    }
    
    selectLetter(index) {
        if (this.letterPositions[index].selected) return;
        
        this.letterPositions[index].selected = true;
        this.currentGuess += this.letterPositions[index].letter;
        
        if (this.currentGuess.length === this.word.length) {
            this.checkSolution();
        }
    }
    
    resetGuess() {
        this.currentGuess = '';
        this.letterPositions.forEach(lp => lp.selected = false);
    }
    
    checkSolution() {
        if (this.currentGuess === this.word) {
            this.solved = true;
            return true;
        } else {
            this.attempts++;
            this.resetGuess();
            if (this.attempts >= this.maxAttempts) {
                this.phase = 'failed';
            }
            return false;
        }
    }
    
    getHint() {
        return `Unscramble: ${this.scrambled}`;
    }
}

// 5. LOCK PICKING - Set pins to correct heights
export class LockPickingPuzzle extends Puzzle {
    constructor() {
        super('lock_picking');
        this.pinCount = 5 + Math.floor(Math.random() * 3); // 5-7 pins
        this.pins = [];
        this.maxHeight = 5;
        this.generate();
    }
    
    generate() {
        this.pins = [];
        for (let i = 0; i < this.pinCount; i++) {
            const targetHeight = Utils.randomInt(1, this.maxHeight);
            this.pins.push({
                currentHeight: Utils.randomInt(0, this.maxHeight),
                targetHeight: targetHeight,
                locked: false
            });
        }
    }
    
    adjustPin(index, direction) {
        if (this.pins[index].locked) return;
        
        const pin = this.pins[index];
        pin.currentHeight += direction;
        if (pin.currentHeight < 0) pin.currentHeight = this.maxHeight;
        if (pin.currentHeight > this.maxHeight) pin.currentHeight = 0;
        
        // Check if pin is at correct height (give feedback)
        if (pin.currentHeight === pin.targetHeight) {
            // Pin clicks into place
            pin.locked = true;
        }
        
        this.checkSolution();
    }
    
    checkSolution() {
        this.solved = this.pins.every(pin => pin.locked);
        return this.solved;
    }
    
    getHint() {
        const unlockedCount = this.pins.filter(p => !p.locked).length;
        return `Set all ${this.pinCount} pins to the correct height. ${unlockedCount} remaining.`;
    }
}

// 6. CONSTELLATION - Connect stars in the correct order
export class ConstellationPuzzle extends Puzzle {
    constructor() {
        super('constellation');
        this.starCount = 6 + Math.floor(Math.random() * 4); // 6-9 stars
        this.stars = [];
        this.correctOrder = [];
        this.playerOrder = [];
        this.connections = [];
        this.hintLines = []; // Show faint hint of the pattern
        this.generate();
    }
    
    generate() {
        // Generate random star positions
        this.stars = [];
        for (let i = 0; i < this.starCount; i++) {
            this.stars.push({
                x: 50 + Math.random() * 300,
                y: 50 + Math.random() * 200,
                id: i,
                selected: false
            });
        }
        
        // Generate correct connection order (a path through all stars)
        this.correctOrder = [];
        const available = [...Array(this.starCount).keys()];
        
        // Start from random star
        let current = Utils.randomInt(0, this.starCount - 1);
        this.correctOrder.push(current);
        available.splice(available.indexOf(current), 1);
        
        // Connect to nearest unvisited star
        while (available.length > 0) {
            let nearestDist = Infinity;
            let nearestIdx = 0;
            
            for (const idx of available) {
                const dist = Math.hypot(
                    this.stars[idx].x - this.stars[current].x,
                    this.stars[idx].y - this.stars[current].y
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestIdx = idx;
                }
            }
            
            this.correctOrder.push(nearestIdx);
            available.splice(available.indexOf(nearestIdx), 1);
            current = nearestIdx;
        }
        
        // Generate hint lines (faint pattern)
        this.hintLines = [];
        for (let i = 0; i < this.correctOrder.length - 1; i++) {
            const from = this.stars[this.correctOrder[i]];
            const to = this.stars[this.correctOrder[i + 1]];
            this.hintLines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
        }
    }
    
    selectStar(index) {
        if (this.stars[index].selected) return;
        
        this.stars[index].selected = true;
        this.playerOrder.push(index);
        
        // Add connection line
        if (this.playerOrder.length > 1) {
            const prev = this.playerOrder[this.playerOrder.length - 2];
            this.connections.push({
                from: prev,
                to: index
            });
        }
        
        // Check if wrong order
        const stepIdx = this.playerOrder.length - 1;
        if (this.playerOrder[stepIdx] !== this.correctOrder[stepIdx]) {
            this.attempts++;
            this.resetSelection();
            return false;
        }
        
        if (this.playerOrder.length === this.starCount) {
            this.solved = true;
            return true;
        }
        
        return true;
    }
    
    resetSelection() {
        this.playerOrder = [];
        this.connections = [];
        this.stars.forEach(s => s.selected = false);
    }
    
    checkSolution() {
        return this.solved;
    }
    
    getHint() {
        return 'Connect the stars in the order shown by the faint pattern';
    }
}

// 7. RUNE MATCHING - Match pairs of identical runes
export class RuneMatchingPuzzle extends Puzzle {
    constructor() {
        super('rune_matching');
        this.runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ'];
        this.pairCount = 6 + Math.floor(Math.random() * 3); // 6-8 pairs
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.canFlip = true;
        this.generate();
    }
    
    generate() {
        // Select random runes for pairs
        const shuffledRunes = [...this.runes].sort(() => Math.random() - 0.5);
        const selectedRunes = shuffledRunes.slice(0, this.pairCount);
        
        // Create pairs and shuffle
        this.cards = [];
        for (const rune of selectedRunes) {
            this.cards.push({ rune, flipped: false, matched: false });
            this.cards.push({ rune, flipped: false, matched: false });
        }
        this.cards.sort(() => Math.random() - 0.5);
    }
    
    flipCard(index) {
        if (!this.canFlip) return;
        if (this.cards[index].flipped || this.cards[index].matched) return;
        
        this.cards[index].flipped = true;
        this.flippedCards.push(index);
        
        if (this.flippedCards.length === 2) {
            this.canFlip = false;
            const [first, second] = this.flippedCards;
            
            if (this.cards[first].rune === this.cards[second].rune) {
                // Match found
                this.cards[first].matched = true;
                this.cards[second].matched = true;
                this.matchedPairs++;
                this.flippedCards = [];
                this.canFlip = true;
                
                if (this.matchedPairs === this.pairCount) {
                    this.solved = true;
                }
            } else {
                // No match - flip back after delay
                setTimeout(() => {
                    this.cards[first].flipped = false;
                    this.cards[second].flipped = false;
                    this.flippedCards = [];
                    this.canFlip = true;
                }, 800);
            }
        }
    }
    
    checkSolution() {
        return this.solved;
    }
    
    getHint() {
        return `Find all ${this.pairCount} matching rune pairs`;
    }
}

// 8. PRESSURE PLATES - Step on plates in the right order based on weight hints
export class PressurePlatesPuzzle extends Puzzle {
    constructor() {
        super('pressure_plates');
        this.plateCount = 5 + Math.floor(Math.random() * 3); // 5-7 plates
        this.plates = [];
        this.correctOrder = [];
        this.playerOrder = [];
        this.generate();
    }
    
    generate() {
        // Generate plates with weights
        this.plates = [];
        const weights = [];
        for (let i = 0; i < this.plateCount; i++) {
            const weight = Utils.randomInt(1, 100);
            weights.push({ index: i, weight });
            this.plates.push({
                weight,
                symbol: this.getWeightSymbol(weight),
                pressed: false,
                x: 50 + (i % 4) * 80,
                y: 50 + Math.floor(i / 4) * 80
            });
        }
        
        // Correct order is by weight (lightest to heaviest)
        weights.sort((a, b) => a.weight - b.weight);
        this.correctOrder = weights.map(w => w.index);
    }
    
    getWeightSymbol(weight) {
        if (weight < 25) return '○'; // Light
        if (weight < 50) return '◐'; // Medium-light
        if (weight < 75) return '◑'; // Medium-heavy
        return '●'; // Heavy
    }
    
    pressPlate(index) {
        if (this.plates[index].pressed) return;
        
        this.plates[index].pressed = true;
        this.playerOrder.push(index);
        
        // Check if correct so far
        const stepIdx = this.playerOrder.length - 1;
        if (this.playerOrder[stepIdx] !== this.correctOrder[stepIdx]) {
            this.attempts++;
            this.resetPlates();
            if (this.attempts >= 5) {
                this.phase = 'failed';
            }
            return false;
        }
        
        if (this.playerOrder.length === this.plateCount) {
            this.solved = true;
            return true;
        }
        
        return true;
    }
    
    resetPlates() {
        this.playerOrder = [];
        this.plates.forEach(p => p.pressed = false);
    }
    
    checkSolution() {
        return this.solved;
    }
    
    getHint() {
        return 'Press plates from lightest (○) to heaviest (●)';
    }
}

// 9. SHADOW ALIGNMENT - Rotate objects to cast shadows that form a shape
export class ShadowAlignmentPuzzle extends Puzzle {
    constructor() {
        super('shadow_alignment');
        this.shapes = ['triangle', 'square', 'pentagon', 'hexagon', 'star'];
        this.targetShape = '';
        this.objects = [];
        this.objectCount = 3 + Math.floor(Math.random() * 2); // 3-4 objects
        this.generate();
    }
    
    generate() {
        this.targetShape = Utils.randomChoice(this.shapes);
        
        // Create objects that need to be rotated
        this.objects = [];
        for (let i = 0; i < this.objectCount; i++) {
            this.objects.push({
                rotation: Utils.randomInt(0, 7) * 45, // 0-315 degrees
                correctRotation: Utils.randomInt(0, 7) * 45,
                x: 80 + i * 100,
                y: 150
            });
        }
    }
    
    rotateObject(index) {
        this.objects[index].rotation = (this.objects[index].rotation + 45) % 360;
        this.checkSolution();
    }
    
    checkSolution() {
        this.solved = this.objects.every(obj => obj.rotation === obj.correctRotation);
        return this.solved;
    }
    
    getHint() {
        return `Rotate the objects to cast a ${this.targetShape} shadow`;
    }
}

// 10. ELEMENTAL BALANCE - Balance four elements on scales
export class ElementalBalancePuzzle extends Puzzle {
    constructor() {
        super('elemental_balance');
        this.elements = [
            { name: 'Fire', symbol: 'F', color: '#ff4400' },
            { name: 'Water', symbol: 'W', color: '#4488ff' },
            { name: 'Earth', symbol: 'E', color: '#885522' },
            { name: 'Air', symbol: 'A', color: '#aaddff' }
        ];
        this.vessels = []; // 4 vessels, each needs specific element amounts
        this.inventory = { fire: 10, water: 10, earth: 10, air: 10 };
        this.generate();
    }
    
    generate() {
        // Each vessel needs a specific combination
        this.vessels = [];
        for (let i = 0; i < 4; i++) {
            const target = {
                fire: Utils.randomInt(0, 4),
                water: Utils.randomInt(0, 4),
                earth: Utils.randomInt(0, 4),
                air: Utils.randomInt(0, 4)
            };
            
            // Ensure at least one element needed
            const elements = ['fire', 'water', 'earth', 'air'];
            const randomEl = Utils.randomChoice(elements);
            target[randomEl] = Math.max(1, target[randomEl]);
            
            this.vessels.push({
                target,
                current: { fire: 0, water: 0, earth: 0, air: 0 },
                x: 60 + i * 90,
                y: 100
            });
        }
        
        // Calculate total needed and set inventory
        const totals = { fire: 0, water: 0, earth: 0, air: 0 };
        for (const vessel of this.vessels) {
            totals.fire += vessel.target.fire;
            totals.water += vessel.target.water;
            totals.earth += vessel.target.earth;
            totals.air += vessel.target.air;
        }
        this.inventory = { ...totals };
    }
    
    addElement(vesselIndex, element) {
        if (this.inventory[element] <= 0) return false;
        
        this.inventory[element]--;
        this.vessels[vesselIndex].current[element]++;
        this.checkSolution();
        return true;
    }
    
    removeElement(vesselIndex, element) {
        if (this.vessels[vesselIndex].current[element] <= 0) return false;
        
        this.vessels[vesselIndex].current[element]--;
        this.inventory[element]++;
        return true;
    }
    
    checkSolution() {
        this.solved = this.vessels.every(vessel => {
            return vessel.current.fire === vessel.target.fire &&
                   vessel.current.water === vessel.target.water &&
                   vessel.current.earth === vessel.target.earth &&
                   vessel.current.air === vessel.target.air;
        });
        return this.solved;
    }
    
    getHint() {
        return 'Fill each vessel with the correct combination of elements';
    }
}

// Puzzle Factory
export class PuzzleFactory {
    static puzzleTypes = [
        PatternMemoryPuzzle,
        TileRotationPuzzle,
        SimonSaysPuzzle,
        WordScramblePuzzle,
        LockPickingPuzzle,
        ConstellationPuzzle,
        RuneMatchingPuzzle,
        PressurePlatesPuzzle,
        ShadowAlignmentPuzzle,
        ElementalBalancePuzzle
    ];
    
    static create(type = null) {
        if (type !== null && type >= 0 && type < this.puzzleTypes.length) {
            return new this.puzzleTypes[type]();
        }
        // Random puzzle type
        const PuzzleClass = Utils.randomChoice(this.puzzleTypes);
        return new PuzzleClass();
    }
    
    static createRandom() {
        return this.create(Utils.randomInt(0, this.puzzleTypes.length - 1));
    }
}

export default PuzzleFactory;
