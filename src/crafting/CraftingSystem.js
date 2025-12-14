// Crafting System with 9x9 grid
// Supports shaped and shapeless recipes

export const CraftingMaterials = {
    // Basic materials
    IRON_ORE: {
        id: 'iron_ore',
        name: 'Iron Ore',
        type: 'material',
        color: '#8b8b8b',
        description: 'Raw iron ore, can be smelted into ingots',
        stackable: true,
        maxStack: 99
    },
    IRON_INGOT: {
        id: 'iron_ingot',
        name: 'Iron Ingot',
        type: 'material',
        color: '#a8a8a8',
        description: 'Refined iron, used in crafting',
        stackable: true,
        maxStack: 99
    },
    GOLD_ORE: {
        id: 'gold_ore',
        name: 'Gold Ore',
        type: 'material',
        color: '#ffd700',
        description: 'Raw gold ore, valuable material',
        stackable: true,
        maxStack: 99
    },
    GOLD_INGOT: {
        id: 'gold_ingot',
        name: 'Gold Ingot',
        type: 'material',
        color: '#ffc125',
        description: 'Refined gold, used in magical crafting',
        stackable: true,
        maxStack: 99
    },
    DARK_CRYSTAL: {
        id: 'dark_crystal',
        name: 'Dark Crystal',
        type: 'material',
        color: '#4a0080',
        description: 'A crystal infused with dark energy',
        stackable: true,
        maxStack: 50
    },
    LIGHT_CRYSTAL: {
        id: 'light_crystal',
        name: 'Light Crystal',
        type: 'material',
        color: '#fffacd',
        description: 'A crystal radiating holy light',
        stackable: true,
        maxStack: 50
    },
    FIRE_ESSENCE: {
        id: 'fire_essence',
        name: 'Fire Essence',
        type: 'material',
        color: '#ff4500',
        description: 'Concentrated flame energy',
        stackable: true,
        maxStack: 50
    },
    ICE_ESSENCE: {
        id: 'ice_essence',
        name: 'Ice Essence',
        type: 'material',
        color: '#00ffff',
        description: 'Frozen magical energy',
        stackable: true,
        maxStack: 50
    },
    WOOD: {
        id: 'wood',
        name: 'Wood',
        type: 'material',
        color: '#8b4513',
        description: 'Basic crafting wood',
        stackable: true,
        maxStack: 99
    },
    LEATHER: {
        id: 'leather',
        name: 'Leather',
        type: 'material',
        color: '#8b6914',
        description: 'Treated animal hide',
        stackable: true,
        maxStack: 99
    },
    CLOTH: {
        id: 'cloth',
        name: 'Cloth',
        type: 'material',
        color: '#e6e6fa',
        description: 'Woven fabric',
        stackable: true,
        maxStack: 99
    },
    BONE: {
        id: 'bone',
        name: 'Bone',
        type: 'material',
        color: '#f5f5dc',
        description: 'Skeletal remains, used in dark crafting',
        stackable: true,
        maxStack: 99
    },
    GEM_RUBY: {
        id: 'gem_ruby',
        name: 'Ruby',
        type: 'gem',
        color: '#e0115f',
        description: 'A precious red gem',
        stackable: true,
        maxStack: 20
    },
    GEM_SAPPHIRE: {
        id: 'gem_sapphire',
        name: 'Sapphire',
        type: 'gem',
        color: '#0f52ba',
        description: 'A precious blue gem',
        stackable: true,
        maxStack: 20
    },
    GEM_EMERALD: {
        id: 'gem_emerald',
        name: 'Emerald',
        type: 'gem',
        color: '#50c878',
        description: 'A precious green gem',
        stackable: true,
        maxStack: 20
    },
    MONSTER_FANG: {
        id: 'monster_fang',
        name: 'Monster Fang',
        type: 'material',
        color: '#fffff0',
        description: 'Sharp fang from a defeated monster',
        stackable: true,
        maxStack: 99
    },
    MAGIC_DUST: {
        id: 'magic_dust',
        name: 'Magic Dust',
        type: 'material',
        color: '#dda0dd',
        description: 'Glittering magical particles',
        stackable: true,
        maxStack: 99
    },
    SOUL_SHARD: {
        id: 'soul_shard',
        name: 'Soul Shard',
        type: 'material',
        color: '#7b68ee',
        description: 'Fragment of captured souls',
        stackable: true,
        maxStack: 30
    },
    DRAGON_SCALE: {
        id: 'dragon_scale',
        name: 'Dragon Scale',
        type: 'material',
        color: '#228b22',
        description: 'Extremely rare dragon scale',
        stackable: true,
        maxStack: 10
    },
    ENCHANTED_WOOD: {
        id: 'enchanted_wood',
        name: 'Enchanted Wood',
        type: 'material',
        color: '#9370db',
        description: 'Wood infused with magical energy',
        stackable: true,
        maxStack: 50
    },
    STRING: {
        id: 'string',
        name: 'String',
        type: 'material',
        color: '#f5f5f5',
        description: 'Strong fiber for crafting',
        stackable: true,
        maxStack: 99
    }
};

// Crafting recipes (9x9 grid uses indices 0-8 for rows and columns)
// Pattern uses 'X' for empty slots
export const CraftingRecipes = {
    // Weapons
    iron_sword: {
        id: 'iron_sword',
        name: 'Iron Sword',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['X', 'iron_ingot', 'X'],
            ['X', 'iron_ingot', 'X'],
            ['X', 'wood', 'X']
        ],
        result: {
            type: 'weapon',
            weaponType: 'sword',
            name: 'Iron Sword',
            damage: 15,
            attackSpeed: 1.0,
            color: '#a8a8a8',
            description: 'A sturdy iron sword'
        },
        quantity: 1
    },
    
    gold_sword: {
        id: 'gold_sword',
        name: 'Gold Sword',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['X', 'gold_ingot', 'X'],
            ['X', 'gold_ingot', 'X'],
            ['X', 'wood', 'X']
        ],
        result: {
            type: 'weapon',
            weaponType: 'sword',
            name: 'Gold Sword',
            damage: 12,
            attackSpeed: 1.3,
            color: '#ffd700',
            description: 'A fast golden sword'
        },
        quantity: 1
    },
    
    iron_axe: {
        id: 'iron_axe',
        name: 'Iron Axe',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['iron_ingot', 'iron_ingot', 'X'],
            ['iron_ingot', 'wood', 'X'],
            ['X', 'wood', 'X']
        ],
        result: {
            type: 'weapon',
            weaponType: 'axe',
            name: 'Iron Axe',
            damage: 20,
            attackSpeed: 0.8,
            color: '#a8a8a8',
            description: 'A heavy iron axe'
        },
        quantity: 1
    },
    
    fire_staff: {
        id: 'fire_staff',
        name: 'Fire Staff',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['X', 'fire_essence', 'X'],
            ['X', 'enchanted_wood', 'X'],
            ['X', 'enchanted_wood', 'X']
        ],
        result: {
            type: 'weapon',
            weaponType: 'staff',
            name: 'Fire Staff',
            damage: 25,
            attackSpeed: 0.9,
            element: 'fire',
            color: '#ff4500',
            description: 'A staff imbued with fire magic'
        },
        quantity: 1
    },
    
    ice_staff: {
        id: 'ice_staff',
        name: 'Ice Staff',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['X', 'ice_essence', 'X'],
            ['X', 'enchanted_wood', 'X'],
            ['X', 'enchanted_wood', 'X']
        ],
        result: {
            type: 'weapon',
            weaponType: 'staff',
            name: 'Ice Staff',
            damage: 22,
            attackSpeed: 1.0,
            element: 'ice',
            color: '#00ffff',
            description: 'A staff imbued with ice magic'
        },
        quantity: 1
    },
    
    dark_scythe: {
        id: 'dark_scythe',
        name: 'Dark Scythe',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['dark_crystal', 'iron_ingot', 'iron_ingot'],
            ['X', 'bone', 'X'],
            ['X', 'bone', 'X']
        ],
        result: {
            type: 'weapon',
            weaponType: 'scythe',
            name: 'Dark Scythe',
            damage: 30,
            attackSpeed: 0.7,
            element: 'dark',
            color: '#4a0080',
            description: 'A scythe infused with dark power'
        },
        quantity: 1
    },
    
    bow: {
        id: 'bow',
        name: 'Bow',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['X', 'wood', 'string'],
            ['wood', 'X', 'string'],
            ['X', 'wood', 'string']
        ],
        result: {
            type: 'weapon',
            weaponType: 'bow',
            name: 'Wooden Bow',
            damage: 18,
            attackSpeed: 1.1,
            attackType: 'projectile',
            color: '#8b4513',
            description: 'A simple wooden bow'
        },
        quantity: 1
    },
    
    crossbow: {
        id: 'crossbow',
        name: 'Crossbow',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['iron_ingot', 'iron_ingot', 'iron_ingot'],
            ['string', 'wood', 'X'],
            ['X', 'wood', 'X']
        ],
        result: {
            type: 'weapon',
            weaponType: 'crossbow',
            name: 'Iron Crossbow',
            damage: 28,
            attackSpeed: 0.6,
            attackType: 'projectile',
            color: '#696969',
            description: 'A powerful iron crossbow'
        },
        quantity: 1
    },
    
    // Armor
    iron_helmet: {
        id: 'iron_helmet',
        name: 'Iron Helmet',
        type: 'armor',
        shaped: true,
        pattern: [
            ['iron_ingot', 'iron_ingot', 'iron_ingot'],
            ['iron_ingot', 'X', 'iron_ingot'],
            ['X', 'X', 'X']
        ],
        result: {
            type: 'armor',
            slot: 'helmet',
            name: 'Iron Helmet',
            defense: 8,
            color: '#a8a8a8',
            description: 'A protective iron helmet'
        },
        quantity: 1
    },
    
    iron_chestplate: {
        id: 'iron_chestplate',
        name: 'Iron Chestplate',
        type: 'armor',
        shaped: true,
        pattern: [
            ['iron_ingot', 'X', 'iron_ingot'],
            ['iron_ingot', 'iron_ingot', 'iron_ingot'],
            ['iron_ingot', 'iron_ingot', 'iron_ingot']
        ],
        result: {
            type: 'armor',
            slot: 'armor',
            name: 'Iron Chestplate',
            defense: 15,
            color: '#a8a8a8',
            description: 'Heavy iron body armor'
        },
        quantity: 1
    },
    
    leather_armor: {
        id: 'leather_armor',
        name: 'Leather Armor',
        type: 'armor',
        shaped: true,
        pattern: [
            ['leather', 'X', 'leather'],
            ['leather', 'leather', 'leather'],
            ['leather', 'leather', 'leather']
        ],
        result: {
            type: 'armor',
            slot: 'armor',
            name: 'Leather Armor',
            defense: 8,
            color: '#8b6914',
            description: 'Light and flexible leather armor'
        },
        quantity: 1
    },
    
    mage_robe: {
        id: 'mage_robe',
        name: 'Mage Robe',
        type: 'armor',
        shaped: true,
        pattern: [
            ['cloth', 'magic_dust', 'cloth'],
            ['cloth', 'cloth', 'cloth'],
            ['cloth', 'cloth', 'cloth']
        ],
        result: {
            type: 'armor',
            slot: 'armor',
            name: 'Mage Robe',
            defense: 4,
            manaBonus: 30,
            color: '#9370db',
            description: 'A robe that enhances magical abilities'
        },
        quantity: 1
    },
    
    // Accessories
    ruby_ring: {
        id: 'ruby_ring',
        name: 'Ruby Ring',
        type: 'accessory',
        shaped: true,
        pattern: [
            ['X', 'gem_ruby', 'X'],
            ['gold_ingot', 'X', 'gold_ingot'],
            ['X', 'gold_ingot', 'X']
        ],
        result: {
            type: 'accessory',
            slot: 'accessory1',
            name: 'Ruby Ring',
            bonuses: { strength: 5 },
            color: '#e0115f',
            description: 'A ring that enhances strength'
        },
        quantity: 1
    },
    
    sapphire_ring: {
        id: 'sapphire_ring',
        name: 'Sapphire Ring',
        type: 'accessory',
        shaped: true,
        pattern: [
            ['X', 'gem_sapphire', 'X'],
            ['gold_ingot', 'X', 'gold_ingot'],
            ['X', 'gold_ingot', 'X']
        ],
        result: {
            type: 'accessory',
            slot: 'accessory1',
            name: 'Sapphire Ring',
            bonuses: { intelligence: 5 },
            color: '#0f52ba',
            description: 'A ring that enhances intelligence'
        },
        quantity: 1
    },
    
    emerald_ring: {
        id: 'emerald_ring',
        name: 'Emerald Ring',
        type: 'accessory',
        shaped: true,
        pattern: [
            ['X', 'gem_emerald', 'X'],
            ['gold_ingot', 'X', 'gold_ingot'],
            ['X', 'gold_ingot', 'X']
        ],
        result: {
            type: 'accessory',
            slot: 'accessory1',
            name: 'Emerald Ring',
            bonuses: { vitality: 5 },
            color: '#50c878',
            description: 'A ring that enhances vitality'
        },
        quantity: 1
    },
    
    // Material conversions (shapeless)
    iron_ingot: {
        id: 'iron_ingot',
        name: 'Iron Ingot',
        type: 'material',
        shaped: false,
        ingredients: { 'iron_ore': 2 },
        result: {
            ...CraftingMaterials.IRON_INGOT,
            quantity: 1
        },
        quantity: 1
    },
    
    gold_ingot: {
        id: 'gold_ingot',
        name: 'Gold Ingot',
        type: 'material',
        shaped: false,
        ingredients: { 'gold_ore': 2 },
        result: {
            ...CraftingMaterials.GOLD_INGOT,
            quantity: 1
        },
        quantity: 1
    },
    
    enchanted_wood: {
        id: 'enchanted_wood',
        name: 'Enchanted Wood',
        type: 'material',
        shaped: false,
        ingredients: { 'wood': 3, 'magic_dust': 1 },
        result: {
            ...CraftingMaterials.ENCHANTED_WOOD,
            quantity: 1
        },
        quantity: 1
    },
    
    // Consumables
    health_potion: {
        id: 'health_potion',
        name: 'Health Potion',
        type: 'consumable',
        shaped: false,
        ingredients: { 'monster_fang': 2, 'gem_ruby': 1 },
        result: {
            type: 'consumable',
            name: 'Health Potion',
            effect: 'heal',
            value: 50,
            color: '#ff0000',
            description: 'Restores 50 health'
        },
        quantity: 2
    },
    
    mana_potion: {
        id: 'mana_potion',
        name: 'Mana Potion',
        type: 'consumable',
        shaped: false,
        ingredients: { 'magic_dust': 3, 'gem_sapphire': 1 },
        result: {
            type: 'consumable',
            name: 'Mana Potion',
            effect: 'mana',
            value: 40,
            color: '#0000ff',
            description: 'Restores 40 mana'
        },
        quantity: 2
    },
    
    // Special crafting (large patterns for 9x9)
    dragon_blade: {
        id: 'dragon_blade',
        name: 'Dragon Blade',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['X', 'X', 'X', 'dragon_scale', 'X'],
            ['X', 'X', 'dragon_scale', 'fire_essence', 'X'],
            ['X', 'dragon_scale', 'iron_ingot', 'X', 'X'],
            ['dragon_scale', 'iron_ingot', 'X', 'X', 'X'],
            ['iron_ingot', 'X', 'X', 'X', 'X']
        ],
        result: {
            type: 'weapon',
            weaponType: 'sword',
            name: 'Dragon Blade',
            damage: 50,
            attackSpeed: 1.0,
            element: 'fire',
            color: '#ff4500',
            description: 'A legendary blade forged from dragon scales'
        },
        quantity: 1
    },
    
    soul_reaper: {
        id: 'soul_reaper',
        name: 'Soul Reaper',
        type: 'weapon',
        shaped: true,
        pattern: [
            ['soul_shard', 'dark_crystal', 'dark_crystal'],
            ['X', 'bone', 'X'],
            ['X', 'bone', 'X'],
            ['X', 'bone', 'X']
        ],
        result: {
            type: 'weapon',
            weaponType: 'scythe',
            name: 'Soul Reaper',
            damage: 45,
            attackSpeed: 0.8,
            element: 'dark',
            color: '#4a0080',
            description: 'A scythe that harvests souls',
            special: 'lifesteal'
        },
        quantity: 1
    }
};

// Crafting Manager Class
export class CraftingManager {
    constructor() {
        this.gridSize = 9;
        this.grid = this.createEmptyGrid();
        this.recipes = CraftingRecipes;
        this.materials = CraftingMaterials;
    }
    
    createEmptyGrid() {
        const grid = [];
        for (let i = 0; i < this.gridSize; i++) {
            grid.push([]);
            for (let j = 0; j < this.gridSize; j++) {
                grid[i].push(null);
            }
        }
        return grid;
    }
    
    clearGrid() {
        this.grid = this.createEmptyGrid();
    }
    
    placeItem(row, col, item, quantity = 1) {
        if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) {
            return false;
        }
        
        if (this.grid[row][col] === null) {
            this.grid[row][col] = { item: item, quantity: quantity };
        } else if (this.grid[row][col].item.id === item.id && item.stackable) {
            this.grid[row][col].quantity = Math.min(
                this.grid[row][col].quantity + quantity,
                item.maxStack || 99
            );
        } else {
            return false;
        }
        return true;
    }
    
    removeItem(row, col, quantity = 1) {
        if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) {
            return null;
        }
        
        const slot = this.grid[row][col];
        if (!slot) return null;
        
        if (slot.quantity <= quantity) {
            const removed = { ...slot };
            this.grid[row][col] = null;
            return removed;
        } else {
            slot.quantity -= quantity;
            return { item: slot.item, quantity: quantity };
        }
    }
    
    getItem(row, col) {
        if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) {
            return null;
        }
        return this.grid[row][col];
    }
    
    // Find the bounding box of placed items
    findBoundingBox() {
        let minRow = this.gridSize, maxRow = -1;
        let minCol = this.gridSize, maxCol = -1;
        
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (this.grid[i][j]) {
                    minRow = Math.min(minRow, i);
                    maxRow = Math.max(maxRow, i);
                    minCol = Math.min(minCol, j);
                    maxCol = Math.max(maxCol, j);
                }
            }
        }
        
        if (maxRow === -1) return null;
        
        return {
            minRow, maxRow, minCol, maxCol,
            height: maxRow - minRow + 1,
            width: maxCol - minCol + 1
        };
    }
    
    // Extract the pattern from current grid state
    extractPattern() {
        const bounds = this.findBoundingBox();
        if (!bounds) return null;
        
        const pattern = [];
        for (let i = bounds.minRow; i <= bounds.maxRow; i++) {
            const row = [];
            for (let j = bounds.minCol; j <= bounds.maxCol; j++) {
                const slot = this.grid[i][j];
                row.push(slot ? slot.item.id : 'X');
            }
            pattern.push(row);
        }
        
        return pattern;
    }
    
    // Count all ingredients (for shapeless recipes)
    countIngredients() {
        const counts = {};
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                const slot = this.grid[i][j];
                if (slot) {
                    const id = slot.item.id;
                    counts[id] = (counts[id] || 0) + slot.quantity;
                }
            }
        }
        return counts;
    }
    
    // Check if patterns match
    patternsMatch(pattern1, pattern2) {
        if (pattern1.length !== pattern2.length) return false;
        
        for (let i = 0; i < pattern1.length; i++) {
            if (pattern1[i].length !== pattern2[i].length) return false;
            for (let j = 0; j < pattern1[i].length; j++) {
                if (pattern1[i][j] !== pattern2[i][j]) return false;
            }
        }
        
        return true;
    }
    
    // Check shaped recipe match
    checkShapedRecipe(recipe) {
        const gridPattern = this.extractPattern();
        if (!gridPattern) return false;
        
        return this.patternsMatch(gridPattern, recipe.pattern);
    }
    
    // Check shapeless recipe match
    checkShapelessRecipe(recipe) {
        const gridIngredients = this.countIngredients();
        
        // Check if all required ingredients are present
        for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
            if (!gridIngredients[ingredient] || gridIngredients[ingredient] < count) {
                return false;
            }
        }
        
        // Check if there are no extra ingredients
        const totalRequired = Object.values(recipe.ingredients).reduce((a, b) => a + b, 0);
        const totalProvided = Object.values(gridIngredients).reduce((a, b) => a + b, 0);
        
        return totalProvided === totalRequired;
    }
    
    // Find matching recipe
    findMatchingRecipe() {
        for (const recipe of Object.values(this.recipes)) {
            if (recipe.shaped) {
                if (this.checkShapedRecipe(recipe)) {
                    return recipe;
                }
            } else {
                if (this.checkShapelessRecipe(recipe)) {
                    return recipe;
                }
            }
        }
        return null;
    }
    
    // Craft the item (returns result or null)
    craft() {
        const recipe = this.findMatchingRecipe();
        if (!recipe) return null;
        
        // Clear the grid
        this.clearGrid();
        
        // Return the result
        return {
            item: recipe.result,
            quantity: recipe.quantity
        };
    }
    
    // Get all recipes
    getAllRecipes() {
        return Object.values(this.recipes);
    }
    
    // Get recipes by type
    getRecipesByType(type) {
        return Object.values(this.recipes).filter(r => r.type === type);
    }
    
    // Check if player has materials for a recipe
    canCraftRecipe(recipe, inventory) {
        if (recipe.shaped) {
            const needed = {};
            for (const row of recipe.pattern) {
                for (const cell of row) {
                    if (cell !== 'X') {
                        needed[cell] = (needed[cell] || 0) + 1;
                    }
                }
            }
            
            return this.hasIngredients(needed, inventory);
        } else {
            return this.hasIngredients(recipe.ingredients, inventory);
        }
    }
    
    // Check if inventory has required ingredients
    hasIngredients(needed, inventory) {
        const available = {};
        for (const item of inventory) {
            if (item && item.id) {
                available[item.id] = (available[item.id] || 0) + (item.quantity || 1);
            }
        }
        
        for (const [id, count] of Object.entries(needed)) {
            if (!available[id] || available[id] < count) {
                return false;
            }
        }
        
        return true;
    }
}

export default CraftingManager;
