/**
 * Main Game Loop for Screeps - Improved Version
 * This is the entry point that runs every game tick
 * Features: Static harvesting, path caching, dynamic spawning, tower defense
 */

// Import manager modules
var memoryManager = require('manager.memory');
var spawnManager = require('manager.spawn');
var roomManager = require('manager.room');

// Import role modules
var roleHarvester = require('role.harvester');
var roleMiner = require('role.miner');
var roleHauler = require('role.hauler');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');

module.exports.loop = function () {

    // CPU tracking (optional - comment out if not needed)
    var cpuStart = Game.cpu.getUsed();

    // Memory management - run periodic cleanup
    memoryManager.runCleanup();

    // Process each room
    for(var roomName in Game.rooms) {
        var room = Game.rooms[roomName];

        // Skip rooms we don't own
        if(!room.controller || !room.controller.my) {
            continue;
        }

        // Initialize room memory if needed
        memoryManager.initRoomMemory(room);

        // Run room management (towers, defense, analysis)
        roomManager.run(room);

        // Run spawn management for each spawn in the room
        var spawns = room.find(FIND_MY_SPAWNS);
        for(var spawn of spawns) {
            spawnManager.run(spawn);

            // Display spawn status
            if(spawn.spawning) {
                var spawningCreep = Game.creeps[spawn.spawning.name];
                spawn.room.visual.text(
                    '🛠️' + spawningCreep.memory.role,
                    spawn.pos.x + 1,
                    spawn.pos.y,
                    {align: 'left', opacity: 0.8});
            }
        }
    }

    // Run role logic for each creep
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];

        // Skip creeps that are spawning
        if(creep.spawning) {
            continue;
        }

        try {
            switch(creep.memory.role) {
                case 'harvester':
                    roleHarvester.run(creep);
                    break;
                case 'miner':
                    roleMiner.run(creep);
                    break;
                case 'hauler':
                    roleHauler.run(creep);
                    break;
                case 'upgrader':
                    roleUpgrader.run(creep);
                    break;
                case 'builder':
                    roleBuilder.run(creep);
                    break;
                default:
                    console.log('Unknown role:', creep.memory.role, 'for creep', name);
            }
        } catch(e) {
            console.log('Error running creep', name, ':', e.message);
            console.log(e.stack);
        }
    }

    // CPU tracking - log if usage is high
    var cpuUsed = Game.cpu.getUsed() - cpuStart;
    if(cpuUsed > Game.cpu.tickLimit * 0.8) {
        console.log('High CPU usage:', cpuUsed.toFixed(2), '/', Game.cpu.tickLimit);
    }

    // Log stats every 100 ticks
    if(Game.time % 100 === 0) {
        var stats = memoryManager.getMemoryStats();
        console.log(`[${Game.time}] Memory: ${stats.percentage}, Creeps: ${stats.creepCount}, CPU: ${cpuUsed.toFixed(2)}`);
    }
}