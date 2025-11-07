/**
 * Lab Manager
 * Handles lab operations for producing compounds and boosts
 * Available at RCL 6+ when labs are unlocked
 */

var labManager = {

    /**
     * Initialize lab configuration in room memory
     * @param {Room} room
     */
    initializeLabs: function(room) {
        if (!room.memory.labs) {
            room.memory.labs = {
                inputLabs: [],
                outputLabs: [],
                reactionQueue: [],
                lastUpdate: 0
            };
        }

        // Update lab configuration every 1000 ticks
        if (Game.time - room.memory.labs.lastUpdate < 1000) {
            return;
        }

        var labs = room.find(FIND_MY_STRUCTURES, {
            filter: {structureType: STRUCTURE_LAB}
        });

        if (labs.length < 3) {
            // Need at least 3 labs to run reactions (2 input, 1 output)
            return;
        }

        // Designate 2 labs as input labs (prefer ones near storage/terminal)
        var storage = room.storage || room.terminal;
        if (storage) {
            labs.sort((a, b) => {
                return storage.pos.getRangeTo(a) - storage.pos.getRangeTo(b);
            });
        }

        room.memory.labs.inputLabs = [labs[0].id, labs[1].id];
        room.memory.labs.outputLabs = labs.slice(2).map(l => l.id);
        room.memory.labs.lastUpdate = Game.time;

        console.log(`[${room.name}] Labs configured: 2 input, ${room.memory.labs.outputLabs.length} output`);
    },

    /**
     * Run lab operations
     * @param {Room} room
     */
    run: function(room) {
        // Only run for rooms with RCL 6+
        if (!room.controller || room.controller.level < 6) {
            return;
        }

        this.initializeLabs(room);

        var labData = room.memory.labs;
        if (!labData || labData.inputLabs.length < 2 || labData.outputLabs.length === 0) {
            return;
        }

        var inputLab1 = Game.getObjectById(labData.inputLabs[0]);
        var inputLab2 = Game.getObjectById(labData.inputLabs[1]);

        if (!inputLab1 || !inputLab2) {
            return;
        }

        // Run reactions on output labs
        for (var labId of labData.outputLabs) {
            var outputLab = Game.getObjectById(labId);
            if (!outputLab) {
                continue;
            }

            // Check if lab is on cooldown
            if (outputLab.cooldown > 0) {
                continue;
            }

            // Run reaction if input labs have resources
            if (inputLab1.mineralType && inputLab2.mineralType) {
                var result = outputLab.runReaction(inputLab1, inputLab2);

                if (result === OK) {
                    // Reaction successful
                } else if (result === ERR_NOT_IN_RANGE) {
                    // Labs too far apart (should be within range 2)
                } else if (result === ERR_FULL) {
                    // Output lab is full, need to empty it
                    this.markLabForEmptying(room, outputLab);
                }
            }
        }
    },

    /**
     * Mark a lab for emptying (haulers will handle this)
     * @param {Room} room
     * @param {StructureLab} lab
     */
    markLabForEmptying: function(room, lab) {
        if (!room.memory.labsToEmpty) {
            room.memory.labsToEmpty = [];
        }

        if (!room.memory.labsToEmpty.includes(lab.id)) {
            room.memory.labsToEmpty.push(lab.id);
        }
    },

    /**
     * Set up a reaction to produce
     * @param {Room} room
     * @param {string} resource1 - First input resource
     * @param {string} resource2 - Second input resource
     * @param {string} outputResource - Expected output resource
     */
    setReaction: function(room, resource1, resource2, outputResource) {
        if (!room.memory.labs) {
            this.initializeLabs(room);
        }

        room.memory.labs.currentReaction = {
            input1: resource1,
            input2: resource2,
            output: outputResource
        };

        console.log(`[${room.name}] Lab reaction set: ${resource1} + ${resource2} = ${outputResource}`);
    },

    /**
     * Queue basic compound production (example: produce OH from H2O and O2)
     * @param {Room} room
     */
    queueBasicCompounds: function(room) {
        var terminal = room.terminal;
        var storage = room.storage;

        if (!terminal && !storage) {
            return;
        }

        // Check available base minerals
        var store = terminal ? terminal.store : storage.store;

        // Example: Produce Hydroxide (OH) if we have H and O
        if (store[RESOURCE_HYDROGEN] >= 1000 && store[RESOURCE_OXYGEN] >= 1000) {
            this.setReaction(room, RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_HYDROXIDE);
        }
        // Produce Zynthium Keanite (ZK) if we have Z and K
        else if (store[RESOURCE_ZYNTHIUM] >= 1000 && store[RESOURCE_KEANIUM] >= 1000) {
            this.setReaction(room, RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM_KEANITE);
        }
        // Produce Utrium Lemergite (UL) if we have U and L
        else if (store[RESOURCE_UTRIUM] >= 1000 && store[RESOURCE_LEMERGIUM] >= 1000) {
            this.setReaction(room, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_UTRIUM_LEMERGITE);
        }
    },

    /**
     * Boost a creep with compounds from labs
     * @param {Creep} creep
     * @param {string} compoundType
     * @param {number} bodyParts - Number of parts to boost
     * @returns {boolean} True if boost was successful
     */
    boostCreep: function(creep, compoundType, bodyParts) {
        var room = creep.room;
        var labs = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => {
                return s.structureType === STRUCTURE_LAB &&
                       s.mineralType === compoundType &&
                       s.store[compoundType] >= 30 * bodyParts;
            }
        });

        if (labs.length === 0) {
            return false;
        }

        var lab = labs[0];
        var result = lab.boostCreep(creep, bodyParts);

        if (result === OK) {
            console.log(`[${room.name}] Boosted ${creep.name} with ${compoundType}`);
            return true;
        }

        return false;
    }
};

module.exports = labManager;
