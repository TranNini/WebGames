// Everything that can be carried, crafted or built. Only data.
const material = (name, icon, about) => ({name, icon, about, stack: 30});
const food = (name, icon, hunger, thirst, extra = {}) => ({name, icon, stack: 10, food: {hunger, thirst, ...extra}});
const tool = (name, icon, type, power, durability, damage, about) => ({name, icon, about, tool: {type, power, durability, damage}});

export const ITEMS = {
    branch: material('Branch', '🌿', 'Small branches lie on the ground. Larger ones come from felled trees.'),
    log: material('Log', '🪵', 'Fell a tree with an axe.'),
    plank: material('Plank', '🟫', 'Sawn at a workbench from logs.'),
    stone: material('Stone', '🪨', 'Lies around, and comes from boulders with a pickaxe.'),
    leaf: material('Leaves', '🍃', 'From bushes and felled trees.'),
    bamboo: material('Bamboo', '🎋', 'Cut it with a knife or an axe.'),
    fiber: material('Plant fiber', '🌾', 'From tall grass in the meadows and jungle.'),
    rope: material('Rope', '🧶', 'Twisted from plant fiber.'),
    iron_ore: material('Iron ore', '🟤', 'In the caves and in rusty rock, for a pickaxe.'),
    gold_ore: material('Gold ore', '🟡', 'Rare, deep in the caves. Worth a lot to someone.'),
    crystal: material('Crystal', '💎', 'Glows softly. Found in caves.'),
    ingot: material('Iron ingot', '🔩', 'Smelted in a furnace.'),
    hide: material('Hide', '🦬', 'From boars, jaguars and crocodiles.'),
    feather: material('Feather', '🪶', 'From parrots. Makes arrows fly straighter.'),
    key: {name: 'Rusty key', icon: '🗝️', about: 'Opens something somewhere on this island.', stack: 5},
    seed_berry: {name: 'Berry seeds', icon: '🌱', about: 'Plant them in a garden plot.', stack: 20, seed: 'berries'},
    seed_banana: {name: 'Banana sprout', icon: '🌱', about: 'Plant it in a garden plot.', stack: 20, seed: 'banana'},
    seed_herb: {name: 'Herb seeds', icon: '🌱', about: 'Plant them in a garden plot.', stack: 20, seed: 'herb'},
    gold_coins: {name: 'Gold coins', icon: '🪙', about: 'Treasure. No use here, but they are good for the score.', stack: 99},

    coconut: food('Coconut', '🥥', 12, 18),
    berries: food('Berries', '🫐', 6, 3),
    banana: food('Banana', '🍌', 14, 2),
    mango: food('Mango', '🥭', 16, 6),
    mushroom: food('Mushroom', '🍄', 7, 0, {sick: 0.25}),
    mushroom_cooked: food('Roast mushroom', '🍄', 11, 0),
    fish_raw: food('Raw fish', '🐟', 12, 1, {sick: 0.35}),
    fish_cooked: food('Grilled fish', '🍣', 30, 0, {health: 4}),
    crab_raw: food('Raw crab', '🦀', 8, 0, {sick: 0.45}),
    crab_cooked: food('Boiled crab', '🍤', 22, 0, {health: 3}),
    meat_raw: food('Raw meat', '🥩', 14, 0, {sick: 0.6}),
    meat_cooked: food('Grilled meat', '🍖', 42, 0, {health: 6}),
    biscuits: food('Airline biscuits', '🍪', 16, -3),
    water_bottle: food('Bottle of water', '🧴', 0, 45),
    flask_dirty: food('Flask of river water', '🫙', 0, 35, {sick: 0.3, leaves: 'flask'}),
    flask_clean: food('Flask of boiled water', '🍶', 0, 45, {leaves: 'flask'}),
    flask: {name: 'Empty flask', icon: '🎍', about: 'Fill it at a river or a rain collector.', stack: 5},

    herb: {name: 'Healing herb', icon: '☘️', about: 'Eases poison and sickness. Better as medicine.', stack: 15, heal: {health: 6, cures: ['poison']}},
    bandage: {name: 'Bandage', icon: '🩹', stack: 10, heal: {health: 20}},
    medicine: {name: 'Medicine', icon: '💊', stack: 10, heal: {health: 35, cures: ['poison', 'sick']}},

    axe_stone: tool('Stone axe', '🪓', 'axe', 1, 60, 12, 'Fells trees and hurts.'),
    pick_stone: tool('Stone pickaxe', '⛏️', 'pick', 1, 60, 9, 'Breaks boulders. Too weak for gold.'),
    shovel: tool('Shovel', '🥄', 'shovel', 1, 50, 7, 'Digs up what is buried, and turns soil for a garden.'),
    knife_stone: tool('Stone knife', '🔪', 'knife', 1, 70, 14, 'Cuts bamboo, and gets more out of an animal.'),
    spear: tool('Spear', '🔱', 'spear', 1, 60, 20, 'Long reach. Good against animals and fish.'),
    bow: tool('Bow', '🏹', 'bow', 1, 80, 28, 'Needs arrows. Tap to shoot where you are looking.'),
    rod: tool('Fishing rod', '🎣', 'rod', 1, 50, 2, 'Cast it near deep water and wait for a bite.'),
    torch: tool('Torch', '🔥', 'torch', 1, 240, 7, 'Lights up the night and the caves. Burns down while held.'),
    axe_iron: tool('Iron axe', '🪓', 'axe', 2, 180, 22, 'Fells trees fast.'),
    pick_iron: tool('Iron pickaxe', '⛏️', 'pick', 2, 180, 16, 'Breaks anything, also gold ore.'),
    knife_iron: tool('Iron knife', '🗡️', 'knife', 2, 200, 24, 'Sharp and lasting.'),
    spear_iron: tool('Iron spear', '🔱', 'spear', 2, 180, 34, 'The best weapon on the island.'),
    arrow: {name: 'Arrow', icon: '➶', about: 'For the bow.', stack: 30},

    poncho: {name: 'Grass poncho', icon: '🦺', wear: {warmth: 1.5, rain: 0.5}, about: 'Keeps off some of the rain and the cold.'},
    coat: {name: 'Hide coat', icon: '🧥', wear: {warmth: 3.5, rain: 0.85}, about: 'Warm on cold nights, and sheds the rain.'},
    pilot_jacket: {name: 'Pilot jacket', icon: '🥼', wear: {warmth: 2.5, rain: 0.4}, about: 'Taken from the wreck.'}
};

// at: null by hand, otherwise what must be close: bench, fire or furnace
export const RECIPES = [
    {out: 'rope', needs: {fiber: 3}},
    {out: 'torch', needs: {branch: 1, fiber: 1, leaf: 1}},
    {out: 'axe_stone', needs: {branch: 2, stone: 2, rope: 1}},
    {out: 'pick_stone', needs: {branch: 2, stone: 3, rope: 1}},
    {out: 'knife_stone', needs: {branch: 1, stone: 1, fiber: 1}},
    {out: 'shovel', needs: {branch: 2, stone: 2, rope: 1}},
    {out: 'spear', needs: {branch: 2, stone: 1, rope: 1}},
    {out: 'rod', needs: {bamboo: 1, rope: 1}},
    {out: 'flask', needs: {bamboo: 1, fiber: 1}},
    {out: 'bandage', needs: {fiber: 3, leaf: 1}},
    {out: 'poncho', needs: {leaf: 10, fiber: 6}},

    {out: 'plank', count: 2, needs: {log: 1}, at: 'bench'},
    {out: 'bow', needs: {bamboo: 2, rope: 2}, at: 'bench'},
    {out: 'arrow', count: 5, needs: {branch: 2, stone: 1, feather: 1}, at: 'bench'},
    {out: 'arrow', count: 3, needs: {branch: 2, stone: 1}, at: 'bench'},
    {out: 'coat', needs: {hide: 4, rope: 2}, at: 'bench'},
    {out: 'medicine', needs: {herb: 3, fiber: 1}, at: 'bench'},
    {out: 'axe_iron', needs: {ingot: 2, branch: 2, rope: 1}, at: 'bench'},
    {out: 'pick_iron', needs: {ingot: 2, branch: 2, rope: 1}, at: 'bench'},
    {out: 'knife_iron', needs: {ingot: 1, branch: 1, rope: 1}, at: 'bench'},
    {out: 'spear_iron', needs: {ingot: 2, branch: 2, rope: 1}, at: 'bench'},

    {out: 'fish_cooked', needs: {fish_raw: 1}, at: 'fire'},
    {out: 'crab_cooked', needs: {crab_raw: 1}, at: 'fire'},
    {out: 'meat_cooked', needs: {meat_raw: 1}, at: 'fire'},
    {out: 'mushroom_cooked', needs: {mushroom: 1}, at: 'fire'},
    {out: 'flask_clean', needs: {flask_dirty: 1}, at: 'fire'},

    {out: 'ingot', needs: {iron_ore: 2, log: 1}, at: 'furnace'}
];

export const BUILDS = {
    campfire: {name: 'Campfire', icon: '🔥', cost: {branch: 5, stone: 3}, about: 'Warmth, light and cooking. Rain can put it out unless it has a roof. Scares off predators.'},
    workbench: {name: 'Workbench', icon: '🛠️', cost: {log: 4, rope: 2}, about: 'Needed for the better tools, planks and clothes.'},
    furnace: {name: 'Furnace', icon: '🧱', cost: {stone: 14, log: 2}, about: 'Smelts ore into iron.'},
    chest: {name: 'Storage chest', icon: '🧰', cost: {log: 4, rope: 1}, about: 'Holds 24 stacks.'},
    bed: {name: 'Bed', icon: '🛏️', cost: {branch: 4, leaf: 10, fiber: 4}, about: 'Sleep through the night, and rest fully.'},
    garden: {name: 'Garden plot', icon: '🌱', cost: {branch: 2, fiber: 2}, needsTool: 'shovel', about: 'Plant seeds here for food in the long run. Rain helps.'},
    collector: {name: 'Rain collector', icon: '🌧️', cost: {bamboo: 3, leaf: 6}, about: 'Fills with clean water when it rains.'},
    floor: {name: 'Wooden floor', icon: '⬜', cost: {log: 2}, snap: true, about: 'A 3 by 3 m platform. Pieces snap together.'},
    wall: {name: 'Wall', icon: '🧱', cost: {log: 2, rope: 1}, snap: true, edge: true, about: 'Snaps to the edge of the grid.'},
    doorway: {name: 'Wall with door', icon: '🚪', cost: {log: 2, rope: 1}, snap: true, edge: true, about: 'Walk through it.'},
    window: {name: 'Wall with window', icon: '🪟', cost: {log: 2, rope: 1}, snap: true, edge: true, about: 'Lets in the view.'},
    roof: {name: 'Thatch roof', icon: '🛖', cost: {log: 1, leaf: 8}, snap: true, about: 'Keeps the rain off whatever is under it.'},
    hut: {name: 'Wooden hut', icon: '🛖', cost: {log: 10, rope: 4, leaf: 14}, about: 'A ready small hut with a roof.'},
    house: {name: 'Large house', icon: '🏠', cost: {log: 22, plank: 8, rope: 8, leaf: 26}, about: 'A big house with room for your whole base.'},
    fence: {name: 'Fence', icon: '🚧', cost: {branch: 3, rope: 1}, snap: true, edge: true, about: 'Keeps animals out.'},
    bridge: {name: 'Bridge', icon: '🌉', cost: {log: 3, rope: 2}, needsWater: true, about: 'Each piece is 4 m long. Start it at the bank.'},
    boat: {name: 'Boat', icon: '⛵', cost: {log: 10, bamboo: 6, rope: 6}, needsWater: true, about: 'Reaches the small islands. Place it in shallow water.'},
    sos: {name: 'SOS sign', icon: '🆘', cost: {}, needsBeach: true, about: 'Marks out a big SOS on the beach. Then lay 34 stones on it, so the helicopter can see you from the air.'}
};

export const SOS_STONES = 34;
