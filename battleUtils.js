import Player from "./models/player.js";

const pokemonList = [
  { name: "Pikachu", baseHP: 40 },
  { name: "Charmander", baseHP: 38 },
  { name: "Squirtle", baseHP: 44 },
  { name: "Bulbasaur", baseHP: 46 },
  { name: "Pidgey", baseHP: 30 },
  { name: "Geodude", baseHP: 52 },
  { name: "Growlithe", baseHP: 41 }
];

const npcNames = [
  "Treinador Joey",
  "Lass Ana",
  "Gary",
  "Bug Catcher Leo",
  "Youngster Tim"
];

export async function getPlayerPokemon(playerId, pokemonIndexOrName = null) {
  const player = await Player.findOne({ userId: playerId });
  if (!player || !player.Pokemons || player.Pokemons.length === 0) {
    return null;
  }

  let activePokemon;
  
  if (pokemonIndexOrName === null) {
    // Se não especificado, retorna o primeiro
    activePokemon = player.Pokemons[0];
  } else if (typeof pokemonIndexOrName === 'number') {
    // Se for número, usa como índice
    if (pokemonIndexOrName < 0 || pokemonIndexOrName >= player.Pokemons.length) {
      return null;
    }
    activePokemon = player.Pokemons[pokemonIndexOrName];
  } else {
    // Se for string, procura por nome
    const pokemonName = pokemonIndexOrName.toString().toLowerCase();
    activePokemon = player.Pokemons.find(p => 
      p.name && p.name.toLowerCase() === pokemonName
    );
    if (!activePokemon) {
      return null;
    }
  }

  if (!activePokemon) {
    return null;
  }

  // Retorna o índice também para uso na batalha
  const index = player.Pokemons.indexOf(activePokemon);
  
  return {
    name: activePokemon.name || "Unknown",
    hp: activePokemon.hp || 50,
    maxHP: activePokemon.maxHP || 50,
    level: activePokemon.level || 1,
    xp: activePokemon.xp || 0,
    index: index
  };
}

// Retorna lista de todos os Pokémon do jogador
export async function getPlayerPokemonList(playerId) {
  const player = await Player.findOne({ userId: playerId });
  if (!player || !player.Pokemons || player.Pokemons.length === 0) {
    return [];
  }
  return player.Pokemons.map((p, index) => ({
    name: p.name || "Unknown",
    hp: p.hp || 50,
    maxHP: p.maxHP || 50,
    level: p.level || 1,
    index: index
  }));
}

export function createTrainerPokemon() {
  const npc = npcNames[Math.floor(Math.random() * npcNames.length)];
  const base = pokemonList[Math.floor(Math.random() * pokemonList.length)];
  const level = Math.floor(Math.random() * 10) + 1; // Level 1-10
  const bonus = Math.floor(Math.random() * 15);
  const hp = base.baseHP + bonus + (level * 2);

  return {
    npc,
    pokemon: {
      name: base.name,
      hp: hp,
      maxHP: hp,
      level: level
    }
  };
}

export function createWildPokemon() {
  const base = pokemonList[Math.floor(Math.random() * pokemonList.length)];
  const level = Math.floor(Math.random() * 10) + 1; // Level 1-10
  const bonus = Math.floor(Math.random() * 15);
  const hp = base.baseHP + bonus + (level * 2);

  return {
    pokemon: {
      name: base.name,
      hp: hp,
      maxHP: hp,
      level: level
    }
  };
}

// Função para calcular XP baseado no nível do oponente
export function calculateXPReward(opponentLevel, battleType) {
  const baseXP = opponentLevel * 10;
  const typeMultiplier = battleType === "wild" ? 1.5 : 1.0;
  return Math.floor(baseXP * typeMultiplier);
}
