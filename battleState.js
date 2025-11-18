import Battle from "./models/battleSchema.js";
import { calculateXPReward, getPlayerPokemon } from "./battleUtils.js";
import Player from "./models/player.js";
import { getPokemonSkills, calculateSkillDamage } from "./pokemonSkills.js";
import { getPokeballByName } from "./models/pokeballSchema.js";

export async function createBattle(playerId, playerPokemon, npcData, battleType = "trainer", allPokemons = []) {
  const battleId = `${playerId}_${Date.now()}`;
  const xpReward = calculateXPReward(npcData.pokemon.level || 1, battleType);

  // Inicializar PP das skills do Pokémon (usar objeto ao invés de Map para MongoDB)
  const availableSkills = await getPokemonSkills(playerPokemon.name);
  const skillPP = {};
  availableSkills.forEach(skill => {
    skillPP[skill.name] = skill.pp || 35;
  });

  // Criar lista de índices dos Pokémon disponíveis
  const availablePokemons = allPokemons.map((p, idx) => idx);
  const defeatedPokemons = [];

  return await Battle.create({
    battleId,
    playerId,
    battleType,
    playerPokemon: {
      name: playerPokemon.name,
      hp: playerPokemon.hp,
      maxHP: playerPokemon.maxHP || playerPokemon.hp,
      level: playerPokemon.level || 1,
      xp: playerPokemon.xp || 0
    },
    pokemonIndex: playerPokemon.index !== undefined ? playerPokemon.index : 0,
    availablePokemons: availablePokemons,
    defeatedPokemons: defeatedPokemons,
    skillPP: skillPP,
    npc: npcData.npc || "Pokémon Selvagem",
    npcPokemon: npcData.pokemon,
    currentTurn: "player",
    turnNumber: 1,
    status: "active",
    xpReward
  });
}

export async function getBattle(id) {
  return await Battle.findOne({ battleId: id });
}

export async function getPlayerBattle(playerId) {
  return await Battle.findOne({ 
    playerId, 
    status: "active" 
  });
}

export async function updateBattle(battleData) {
  await Battle.updateOne({ battleId: battleData.battleId }, battleData);
}

export async function deleteBattle(id) {
  await Battle.deleteOne({ battleId: id });
}

// Calcula dano de ataque (fallback)
export function calculateDamage(attackerLevel, defenderLevel) {
  const baseDamage = 10 + (attackerLevel * 2);
  const variance = Math.floor(Math.random() * 10) - 5; // -5 a +5
  const damage = Math.max(1, baseDamage + variance);
  return damage;
}

// Processa ataque do jogador com skill
export async function processPlayerAttack(battle, skillName = null) {
  if (battle.status !== "active" || battle.currentTurn !== "player") {
    return { success: false, message: "Não é seu turno ou a batalha já terminou!" };
  }

  // Buscar skills disponíveis
  const availableSkills = await getPokemonSkills(battle.playerPokemon.name);
  
  let skill = null;
  if (skillName) {
    // Procurar skill pelo nome (case-insensitive)
    skill = availableSkills.find(s => 
      s.name.toLowerCase() === skillName.toLowerCase()
    ) || availableSkills[0];
  } else {
    // Fallback para ataque básico
    skill = availableSkills[0];
  }

  // Verificar PP da skill (converter Map para objeto se necessário)
  if (!battle.skillPP) {
    battle.skillPP = {};
  }
  if (battle.skillPP instanceof Map) {
    battle.skillPP = Object.fromEntries(battle.skillPP);
  }
  const currentPP = battle.skillPP[skill.name] || skill.pp || 35;
  
  if (currentPP <= 0) {
    const availableSkillsWithPP = availableSkills.filter(s => {
      const pp = battle.skillPP[s.name] || s.pp || 35;
      return pp > 0;
    });
    
    if (availableSkillsWithPP.length === 0) {
      return { success: false, message: `❌ **${battle.playerPokemon.name}** não tem mais PP em nenhuma skill!` };
    }
    
    const skillNames = availableSkillsWithPP.map(s => s.name).join(", ");
    return { success: false, message: `❌ **${skill.name}** não tem mais PP! Use outra skill.\n\nSkills disponíveis: ${skillNames}` };
  }

  // Reduzir PP
  battle.skillPP[skill.name] = currentPP - 1;
  
  const damage = calculateSkillDamage(skill, battle.playerPokemon.level, battle.npcPokemon.level);
  battle.npcPokemon.hp = Math.max(0, battle.npcPokemon.hp - damage);
  
  let result = {
    success: true,
    damage,
    skill: skill.name,
    ppRemaining: currentPP - 1,
    message: `💥 ${battle.playerPokemon.name} usou **${skill.name}** e causou ${damage} de dano! (PP: ${currentPP - 1}/${skill.pp})`
  };

  // Verifica se o oponente foi derrotado
  if (battle.npcPokemon.hp <= 0) {
    battle.status = "player_won";
    battle.npcPokemon.hp = 0;
    result.message += `\n🎉 ${battle.npcPokemon.name} foi derrotado! Você venceu!`;
    result.battleEnded = true;
    
    // Distribui XP
    await distributeXP(battle);
  } else {
    // Passa o turno para o oponente
    battle.currentTurn = "opponent";
    battle.turnNumber += 1;
  }

  await updateBattle(battle);
  return result;
}

// Troca de Pokémon quando o atual é derrotado
export async function switchPokemon(battle, newPokemonIndex) {
  const player = await Player.findOne({ userId: battle.playerId });
  if (!player || !player.Pokemons || player.Pokemons.length === 0) {
    return { success: false, message: "Erro ao encontrar seus Pokémon!" };
  }

  // Verificar se o índice é válido
  if (newPokemonIndex < 0 || newPokemonIndex >= player.Pokemons.length) {
    return { success: false, message: "Índice de Pokémon inválido!" };
  }

  // Verificar se o Pokémon já foi derrotado
  if (battle.defeatedPokemons && battle.defeatedPokemons.includes(newPokemonIndex)) {
    return { success: false, message: "Este Pokémon já foi derrotado!" };
  }

  // Verificar se o Pokémon está disponível
  if (!battle.availablePokemons || !battle.availablePokemons.includes(newPokemonIndex)) {
    return { success: false, message: "Este Pokémon não está disponível!" };
  }

  const newPokemon = player.Pokemons[newPokemonIndex];
  
  // Atualizar batalha com novo Pokémon
  battle.playerPokemon = {
    name: newPokemon.name,
    hp: newPokemon.hp,
    maxHP: newPokemon.maxHP || newPokemon.hp,
    level: newPokemon.level || 1,
    xp: newPokemon.xp || 0
  };
  battle.pokemonIndex = newPokemonIndex;

  // Reinicializar PP das skills do novo Pokémon
  const availableSkills = await getPokemonSkills(newPokemon.name);
  battle.skillPP = {};
  availableSkills.forEach(skill => {
    battle.skillPP[skill.name] = skill.pp || 35;
  });

  await updateBattle(battle);

  return {
    success: true,
    message: `🔄 Você trocou para **${newPokemon.name}** (Nível ${newPokemon.level}) - HP: ${newPokemon.hp}/${newPokemon.maxHP}!`,
    pokemon: battle.playerPokemon
  };
}

// Processa ataque do oponente (NPC)
export async function processOpponentAttack(battle) {
  if (battle.status !== "active" || battle.currentTurn !== "opponent") {
    return { success: false };
  }

  // NPC usa skill aleatória
  const availableSkills = await getPokemonSkills(battle.npcPokemon.name);
  const randomSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
  const damage = calculateSkillDamage(randomSkill, battle.npcPokemon.level, battle.playerPokemon.level);
  
  battle.playerPokemon.hp = Math.max(0, battle.playerPokemon.hp - damage);
  
  let result = {
    success: true,
    damage,
    skill: randomSkill.name,
    message: `💥 ${battle.npcPokemon.name} usou **${randomSkill.name}** e causou ${damage} de dano!`
  };

  // Verifica se o jogador foi derrotado
  if (battle.playerPokemon.hp <= 0) {
    battle.status = "opponent_won";
    battle.playerPokemon.hp = 0;
    result.message += `\n💀 ${battle.playerPokemon.name} foi derrotado! Você perdeu!`;
    result.battleEnded = true;
  } else {
    // Passa o turno para o jogador
    battle.currentTurn = "player";
  }

  await updateBattle(battle);
  return result;
}

// Distribui XP ao final da batalha
async function distributeXP(battle) {
  if (battle.status !== "player_won") return;

  const player = await Player.findOne({ userId: battle.playerId });
  if (!player) return;

  // Adiciona XP ao jogador
  player.XP = (player.XP || 0) + battle.xpReward;
  
  // Atualiza XP do Pokémon que participou da batalha
  if (player.Pokemons && player.Pokemons.length > 0) {
    const pokemonIndex = battle.pokemonIndex !== undefined ? battle.pokemonIndex : 0;
    if (pokemonIndex >= 0 && pokemonIndex < player.Pokemons.length) {
      const activePokemon = player.Pokemons[pokemonIndex];
      activePokemon.xp = (activePokemon.xp || 0) + battle.xpReward;
      
      // Verifica level up (100 XP por nível)
      const newLevel = Math.floor(activePokemon.xp / 100) + 1;
      if (newLevel > (activePokemon.level || 1)) {
        activePokemon.level = newLevel;
        // Aumenta HP máximo ao subir de nível
        activePokemon.maxHP = (activePokemon.maxHP || 50) + 10;
        activePokemon.hp = activePokemon.maxHP;
      }
      
      player.Pokemons[pokemonIndex] = activePokemon;
    }
  }

  await player.save();
}

// Tenta capturar um Pokémon selvagem usando pokébola
export async function attemptCapture(battle, pokeballName = "Pokébola") {
  if (battle.battleType !== "wild") {
    return { success: false, message: "Você só pode capturar Pokémon selvagens!" };
  }

  if (battle.status !== "active") {
    return { success: false, message: "A batalha já terminou!" };
  }

  // Verificar se o jogador tem a pokébola
  const player = await Player.findOne({ userId: battle.playerId });
  if (!player) {
    return { success: false, message: "Erro ao encontrar jogador!" };
  }

  // Converter Map para objeto se necessário
  let pokeballs = player.Pokeballs;
  if (pokeballs instanceof Map) {
    pokeballs = Object.fromEntries(pokeballs);
  } else if (!pokeballs || typeof pokeballs !== 'object') {
    pokeballs = { "Pokébola": 5 }; // Default
  }

  const pokeballCount = pokeballs[pokeballName] || 0;
  
  if (pokeballCount <= 0) {
    const availableBalls = Object.entries(pokeballs)
      .filter(([_, count]) => count > 0)
      .map(([name, _]) => name)
      .join(", ");
    
    if (availableBalls) {
      return { success: false, message: `❌ Você não tem **${pokeballName}**! Pokébolas disponíveis: ${availableBalls}` };
    } else {
      return { success: false, message: `❌ Você não tem pokébolas! Use \`/givepokeball\` (mods) para obter pokébolas.` };
    }
  }

  // Obter dados da pokébola
  const pokeball = getPokeballByName(pokeballName);
  
  // Chance de captura baseada no HP restante do Pokémon e tipo de pokébola
  const hpPercentage = battle.npcPokemon.hp / battle.npcPokemon.maxHP;
  const baseChance = pokeball.baseChance;
  const hpBonus = (1 - hpPercentage) * 0.5; // Até 50% bonus se HP baixo
  const captureChance = Math.min(0.95, baseChance + hpBonus);
  
  const captured = Math.random() < captureChance;

  // Consumir pokébola
  pokeballs[pokeballName] = pokeballCount - 1;
  player.Pokeballs = pokeballs;
  await player.save();

  if (captured) {
    // Adiciona Pokémon à coleção do jogador
    if (!player.Pokemons) {
      player.Pokemons = [];
    }
    
    player.Pokemons.push({
      name: battle.npcPokemon.name,
      hp: battle.npcPokemon.maxHP,
      maxHP: battle.npcPokemon.maxHP,
      level: battle.npcPokemon.level,
      xp: 0
    });
    
    await player.save();

    battle.status = "finished";
    await updateBattle(battle);
    
    return { 
      success: true, 
      message: `🎉 Você capturou ${battle.npcPokemon.name} usando uma **${pokeballName}**!`,
      battleEnded: true
    };
  } else {
    // Passa o turno para o oponente após tentativa falha
    battle.currentTurn = "opponent";
    battle.turnNumber += 1;
    await updateBattle(battle);
    
    return { 
      success: false, 
      message: `❌ ${battle.npcPokemon.name} escapou da **${pokeballName}**! O turno passou para o oponente.`
    };
  }
}

// Processa fuga da batalha
export async function processFlee(battle) {
  if (battle.status !== "active") {
    return { success: false, message: "A batalha já terminou!" };
  }

  // Chance de fuga: 90% (alta chance de sucesso)
  const fleeChance = 0.9;
  const fled = Math.random() < fleeChance;

  if (fled) {
    battle.status = "finished";
    await updateBattle(battle);
    return { 
      success: true, 
      message: `🏃 Você fugiu da batalha com sucesso!`,
      battleEnded: true
    };
  } else {
    // Se falhar, o oponente ataca
    battle.currentTurn = "opponent";
    battle.turnNumber += 1;
    await updateBattle(battle);
    
    const opponentAttack = await processOpponentAttack(battle);
    return {
      success: false,
      message: `❌ Você não conseguiu fugir!`,
      opponentAttack
    };
  }
}
