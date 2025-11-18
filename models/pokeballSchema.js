// Schema para tipos de pokébolas disponíveis no sistema

export const pokeballTypes = {
  "Pokébola": {
    name: "Pokébola",
    rarity: "common",
    baseChance: 0.3, // 30% base
    description: "Uma pokébola básica e comum"
  },
  "Super Bola": {
    name: "Super Bola",
    rarity: "uncommon",
    baseChance: 0.45, // 45% base
    description: "Uma pokébola melhorada com maior chance de captura"
  },
  "Ultra Bola": {
    name: "Ultra Bola",
    rarity: "rare",
    baseChance: 0.6, // 60% base
    description: "Uma pokébola de alta qualidade"
  },
  "Master Bola": {
    name: "Master Bola",
    rarity: "legendary",
    baseChance: 1.0, // 100% - sempre captura
    description: "A pokébola definitiva que sempre captura"
  }
};

// Retorna pokébola por nome
export function getPokeballByName(name) {
  return pokeballTypes[name] || pokeballTypes["Pokébola"];
}

// Retorna todas as pokébolas
export function getAllPokeballs() {
  return Object.values(pokeballTypes);
}

