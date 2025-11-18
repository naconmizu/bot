import { Schema, model } from "mongoose";

const BattleSchema = new Schema({
  battleId: { type: String, required: true, unique: true },
  playerId: String,

  battleType: { 
    type: String, 
    enum: ["wild", "trainer"], 
    default: "trainer" 
  },

  playerPokemon: {
    name: String,
    hp: Number,
    maxHP: Number,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 }
  },
  pokemonIndex: { type: Number, default: 0 }, // Índice do Pokémon na lista do jogador
  availablePokemons: { type: Array, default: [] }, // Lista de índices dos Pokémon disponíveis
  defeatedPokemons: { type: Array, default: [] }, // Lista de índices dos Pokémon derrotados
  skillPP: { type: Object, default: {} }, // PP restante de cada skill (nome: PP)

  npc: String,
  npcPokemon: {
    name: String,
    hp: Number,
    maxHP: Number,
    level: { type: Number, default: 1 }
  },

  currentTurn: { 
    type: String, 
    enum: ["player", "opponent"], 
    default: "player" 
  },
  turnNumber: { type: Number, default: 1 },
  status: { 
    type: String, 
    enum: ["active", "finished", "player_won", "opponent_won"], 
    default: "active" 
  },
  xpReward: { type: Number, default: 0 }
});

export default model("Battle", BattleSchema);
