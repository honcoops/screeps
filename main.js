/**
 * Main Game Loop for Screeps
 * This is the entry point that runs every game tick
 */

// Import role modules
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');

module.exports.loop = function () {
    
    // Clean up memory of dead creeps
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    // Count creeps by role
    var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
    var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
    var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');

    // Auto-spawn creeps based on needs
    var spawn = Game.spawns['Spawn1'];
    
    // Minimum creep counts
    var minHarvesters = 2;
    var minUpgraders = 2;
    var minBuilders = 2;

    // Spawn harvesters first (highest priority)
    if(harvesters.length < minHarvesters) {
        var newName = 'Harvester' + Game.time;
        console.log('Spawning new harvester: ' + newName);
        spawn.spawnCreep([WORK, CARRY, MOVE], newName, 
            {memory: {role: 'harvester'}});
    }
    // Then spawn upgraders
    else if(upgraders.length < minUpgraders) {
        var newName = 'Upgrader' + Game.time;
        console.log('Spawning new upgrader: ' + newName);
        spawn.spawnCreep([WORK, CARRY, MOVE], newName,
            {memory: {role: 'upgrader'}});
    }
    // Finally spawn builders
    else if(builders.length < minBuilders) {
        var newName = 'Builder' + Game.time;
        console.log('Spawning new builder: ' + newName);
        spawn.spawnCreep([WORK, CARRY, MOVE], newName,
            {memory: {role: 'builder'}});
    }

    // Display spawn status
    if(spawn.spawning) { 
        var spawningCreep = Game.creeps[spawn.spawning.name];
        spawn.room.visual.text(
            '🛠️' + spawningCreep.memory.role,
            spawn.pos.x + 1, 
            spawn.pos.y, 
            {align: 'left', opacity: 0.8});
    }

    // Run role logic for each creep
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        if(creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        if(creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
    }
}