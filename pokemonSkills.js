// Sistema de skills/moves para Pokémon usando PokeAPI
import { getPokemonMovesFromAPI } from './pokeapiService.js';

// Cache local para skills já buscadas (evita múltiplas chamadas na mesma batalha)
const skillsCache = new Map();

// Skills padrão caso a API falhe
const defaultSkills = {
  "Tackle": {
    name: "Tackle",
    power: 40,
    type: "normal",
    pp: 35,
    description: "Um ataque físico básico"
  },
  "Quick Attack": {
    name: "Quick Attack",
    power: 40,
    type: "normal",
    pp: 30,
    description: "Um ataque rápido que sempre acerta primeiro"
  },
  "Scratch": {
    name: "Scratch",
    power: 40,
    type: "normal",
    pp: 35,
    description: "Arranha o oponente com garras afiadas"
  },
  "Bite": {
    name: "Bite",
    power: 60,
    type: "dark",
    pp: 25,
    description: "Morde o oponente com força"
  }
};

/**
 * Retorna skills disponíveis para um pokemon usando a PokeAPI
 * Usa cache para evitar múltiplas chamadas à API
 */
export async function getPokemonSkills(pokemonName) {
  if (!pokemonName) {
    return Object.values(defaultSkills).slice(0, 4);
  }

  // Verificar cache local (útil durante uma batalha)
  const cacheKey = pokemonName.toLowerCase().trim();
  if (skillsCache.has(cacheKey)) {
    return skillsCache.get(cacheKey);
  }

  try {
    // Buscar moves da API
    const moves = await getPokemonMovesFromAPI(pokemonName);
    
    // Converter para o formato esperado
    const formattedSkills = moves.map(move => ({
      name: move.name,
      power: move.power || 40,
      type: move.type || "normal",
      pp: move.pp || 20,
      description: move.description || "No description available"
    }));

    // Garantir pelo menos 4 skills
    while (formattedSkills.length < 4) {
      formattedSkills.push(...Object.values(defaultSkills).slice(0, 4 - formattedSkills.length));
    }

    // Cache local (dura apenas durante a execução)
    skillsCache.set(cacheKey, formattedSkills.slice(0, 4));

    return formattedSkills.slice(0, 4);
  } catch (error) {
    console.error(`Erro ao buscar skills para ${pokemonName}:`, error);
    // Retornar skills padrão em caso de erro
    return Object.values(defaultSkills).slice(0, 4);
  }
}

/**
 * Limpa o cache local de skills
 */
export function clearSkillsCache() {
  skillsCache.clear();
}

// Calcula dano baseado na skill
export function calculateSkillDamage(skill, attackerLevel, defenderLevel) {
  const basePower = skill.power || 40;
  const levelMultiplier = 1 + (attackerLevel / 10);
  const baseDamage = Math.floor(basePower * levelMultiplier);
  const variance = Math.floor(Math.random() * 20) - 10; // -10 a +10
  const damage = Math.max(1, baseDamage + variance);
  return damage;
}

