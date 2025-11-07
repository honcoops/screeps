# Screeps Basic Starter Code

This is a basic starting codebase for Screeps that will get you up and running with automated harvesting, building, and controller upgrading.

## What is Screeps?

Screeps is an MMO strategy game where you control your colony by writing JavaScript code. Your units (called "creeps") operate autonomously based on the AI you program, even when you're offline.

## Files Included

1. **main.js** - The main game loop that runs every tick
2. **role.harvester.js** - Creeps that harvest energy and deliver it to spawn/extensions
3. **role.upgrader.js** - Creeps that upgrade the room controller
4. **role.builder.js** - Creeps that construct buildings

## How to Use This Code

### In the Screeps Tutorial/Simulator:
1. Go to https://screeps.com/a/#!/sim/tutorial
2. Open the Script tab
3. Create new modules for each role file (role.harvester, role.upgrader, role.builder)
4. Copy the respective code into each module
5. Replace the main module code with the content from main.js
6. The code will start running automatically

### In the Live Game:
1. Copy each file's contents into the corresponding module in the Screeps editor
2. Make sure your spawn is named "Spawn1" (or update the code to match your spawn name)
3. The code will automatically start spawning and managing creeps

## What This Code Does

### Main Loop (main.js)
- **Memory Management**: Cleans up memory from dead creeps to prevent memory leaks
- **Creep Counting**: Tracks how many of each role you have
- **Auto-Spawning**: Automatically spawns new creeps when needed:
  - 2 Harvesters (priority)
  - 2 Upgraders
  - 2 Builders
- **Role Assignment**: Runs the appropriate behavior for each creep based on its role

### Harvester Role
- Harvests energy from sources
- Delivers energy to spawn, extensions, or towers
- If no structures need energy, upgrades the controller instead

### Upgrader Role
- Harvests energy from sources
- Uses energy to upgrade the room controller
- Essential for progressing through Room Control Levels (RCL)

### Builder Role
- Harvests energy from sources
- Builds construction sites
- If no construction sites exist, upgrades the controller instead

## Key Concepts

### Energy
Energy is the main resource in Screeps. It's used for:
- Spawning creeps
- Building structures
- Upgrading the room controller

### Room Controller
The room controller determines your Room Control Level (RCL). Higher levels unlock:
- More structures
- Bigger creeps
- New abilities

### Creep Body Parts
Each creep has body parts that determine its capabilities:
- **WORK**: Required for harvesting, building, and upgrading
- **CARRY**: Allows the creep to carry energy
- **MOVE**: Allows the creep to move

The basic creep design `[WORK, CARRY, MOVE]` costs 200 energy and is the minimum viable creep.

## Customization Tips

### Adjust Creep Counts
In main.js, modify these values:
```javascript
var minHarvesters = 2;  // Change to spawn more/fewer harvesters
var minUpgraders = 2;   // Change to spawn more/fewer upgraders
var minBuilders = 2;    // Change to spawn more/fewer builders
```

### Bigger Creeps
As your Room Control Level increases, you can spawn bigger creeps:
```javascript
// Example: Larger harvester (costs 550 energy, requires RCL 2+)
spawn.spawnCreep([WORK, WORK, WORK, CARRY, MOVE, MOVE], newName, 
    {memory: {role: 'harvester'}});
```

### Multiple Spawns
If you have multiple spawns, change:
```javascript
var spawn = Game.spawns['Spawn1'];
```
To loop through all spawns:
```javascript
for(var spawnName in Game.spawns) {
    var spawn = Game.spawns[spawnName];
    // spawn logic here
}
```

## Next Steps

Once you have this basic code running, consider:

1. **Tower Defense**: Add towers and defender creeps
2. **Remote Harvesting**: Send creeps to harvest from adjacent rooms
3. **Road Networks**: Build roads to speed up creep movement
4. **Static Harvesting**: Keep harvesters at sources and use carriers to transport
5. **Market Trading**: Buy and sell resources on the market
6. **Multi-room Expansion**: Claim additional rooms to grow your empire

## Resources

- Official Documentation: https://docs.screeps.com/
- API Reference: https://docs.screeps.com/api/
- Community Wiki: https://wiki.screepspl.us/
- Discord: Join the Screeps Discord for help and discussion

## Common Issues

### "Spawn1 is not defined"
Your spawn might have a different name. Check `Game.spawns` in the console and update the spawn name in main.js.

### Creeps Not Spawning
- Check that you have enough energy (200 minimum)
- Verify the spawn isn't already spawning another creep
- Make sure the spawn isn't blocked by other structures

### Out of Energy
- Increase the number of harvesters
- Make sure harvesters are delivering to spawn
- Check that creeps aren't dying too frequently

## Performance Note

This basic code is not optimized for CPU usage. As your colony grows, you'll want to:
- Cache expensive operations
- Use more efficient pathfinding
- Implement role-based task management
- Add defensive coding to handle edge cases

Good luck with your automated empire!
