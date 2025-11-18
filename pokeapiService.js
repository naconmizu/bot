// Serviço para buscar dados da PokeAPI
// Cache simples em memória para evitar muitas chamadas

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";

// Cache para moves de Pokémon (pokemonName -> moves array)
const pokemonMovesCache = new Map();

// Cache para detalhes de moves (moveName -> move details)
const moveDetailsCache = new Map();

// Tempo de cache: 1 hora (3600000ms)
const CACHE_DURATION = 3600000;

/**
 * Normaliza o nome do Pokémon para usar na API (lowercase, sem espaços)
 */
function normalizePokemonName(pokemonName) {
  return pokemonName.toLowerCase().trim();
}

/**
 * Busca informações de um Pokémon na PokeAPI
 */
async function fetchPokemonData(pokemonName) {
  const normalizedName = normalizePokemonName(pokemonName);
  const url = `${POKEAPI_BASE_URL}/pokemon/${normalizedName}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        return null; // Pokémon não encontrado
      }
      throw new Error(`PokeAPI error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Erro ao buscar Pokémon ${pokemonName}:`, error);
    return null;
  }
}

/**
 * Busca detalhes de um move na PokeAPI
 */
async function fetchMoveDetails(moveUrl) {
  try {
    const response = await fetch(moveUrl);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`Erro ao buscar move ${moveUrl}:`, error);
    return null;
  }
}

/**
 * Converte dados de move da API para o formato do nosso sistema
 */
function formatMoveData(moveData) {
  if (!moveData) return null;

  // Buscar descrição em português ou inglês
  const descriptionEntry = moveData.flavor_text_entries?.find(
    entry => entry.language.name === "pt" || entry.language.name === "en"
  );
  const description = descriptionEntry?.flavor_text?.replace(/\n|\f/g, " ") || 
                      moveData.effect_entries?.[0]?.effect?.replace(/\n|\f/g, " ") ||
                      "No description available";

  // Capitalizar nome do move
  const moveName = moveData.name
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    name: moveName,
    power: moveData.power || 0, // Se não tiver power, será 0 (status moves)
    type: moveData.type?.name || "normal",
    pp: moveData.pp || 20, // PP padrão se não especificado
    accuracy: moveData.accuracy || 100,
    description: description,
    damageClass: moveData.damage_class?.name || "physical" // physical, special, status
  };
}

/**
 * Busca moves de um Pokémon na PokeAPI
 * Retorna os primeiros 4-6 moves aprendidos por level-up (mais comuns)
 */
export async function getPokemonMovesFromAPI(pokemonName) {
  const normalizedName = normalizePokemonName(pokemonName);
  
  // Verificar cache
  const cached = pokemonMovesCache.get(normalizedName);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.moves;
  }

  // Buscar dados do Pokémon
  const pokemonData = await fetchPokemonData(pokemonName);
  if (!pokemonData) {
    // Se não encontrar, retornar moves padrão
    return getDefaultMoves();
  }

  // Filtrar moves aprendidos por level-up (version_group_details)
  // Pegar moves que são aprendidos em qualquer versão do jogo
  let levelUpMoves = [];
  
  try {
    levelUpMoves = pokemonData.moves
      .filter(move => {
        return move.version_group_details && move.version_group_details.some(detail => 
          detail.move_learn_method && detail.move_learn_method.name === "level-up"
        );
      })
      .map(move => {
        const levelUpDetails = move.version_group_details.filter(d => 
          d.move_learn_method && d.move_learn_method.name === "level-up"
        );
        const minLevel = levelUpDetails.length > 0 
          ? Math.min(...levelUpDetails.map(d => d.level_learned_at || 0))
          : 0;
        return {
          move: move.move,
          minLevel: minLevel
        };
      })
      .sort((a, b) => a.minLevel - b.minLevel) // Ordenar por nível mínimo
      .slice(0, 6); // Pegar os primeiros 6 moves
  } catch (error) {
    console.error("Erro ao processar moves de level-up:", error);
  }

  // Se não tiver moves de level-up, pegar os primeiros moves disponíveis
  const movesToFetch = levelUpMoves.length > 0 
    ? levelUpMoves.map(m => m.move.url)
    : (pokemonData.moves || []).slice(0, 6).map(m => m.move.url);

  // Buscar detalhes de cada move
  const moveDetailsPromises = movesToFetch.map(async (moveUrl) => {
    // Verificar cache de move
    const moveName = moveUrl.split("/").slice(-2, -1)[0];
    const cachedMove = moveDetailsCache.get(moveName);
    if (cachedMove && (Date.now() - cachedMove.timestamp) < CACHE_DURATION) {
      return cachedMove.move;
    }

    const moveData = await fetchMoveDetails(moveUrl);
    if (!moveData) return null;

    const formattedMove = formatMoveData(moveData);
    
    // Cache do move
    if (formattedMove) {
      moveDetailsCache.set(moveName, {
        move: formattedMove,
        timestamp: Date.now()
      });
    }

    return formattedMove;
  });

  const moves = (await Promise.all(moveDetailsPromises))
    .filter(move => move !== null && move.power > 0); // Filtrar moves sem poder (status moves)

  // Se não tiver moves com poder, usar moves padrão
  if (moves.length === 0) {
    return getDefaultMoves();
  }

  // Garantir pelo menos 4 moves
  while (moves.length < 4) {
    moves.push(...getDefaultMoves().slice(0, 4 - moves.length));
  }

  // Cache do resultado
  pokemonMovesCache.set(normalizedName, {
    moves: moves.slice(0, 4), // Limitar a 4 moves
    timestamp: Date.now()
  });

  return moves.slice(0, 4);
}

/**
 * Retorna moves padrão caso a API falhe
 */
function getDefaultMoves() {
  return [
    {
      name: "Tackle",
      power: 40,
      type: "normal",
      pp: 35,
      accuracy: 100,
      description: "Um ataque físico básico",
      damageClass: "physical"
    },
    {
      name: "Quick Attack",
      power: 40,
      type: "normal",
      pp: 30,
      accuracy: 100,
      description: "Um ataque rápido que sempre acerta primeiro",
      damageClass: "physical"
    },
    {
      name: "Scratch",
      power: 40,
      type: "normal",
      pp: 35,
      accuracy: 100,
      description: "Arranha o oponente com garras afiadas",
      damageClass: "physical"
    },
    {
      name: "Bite",
      power: 60,
      type: "dark",
      pp: 25,
      accuracy: 100,
      description: "Morde o oponente com força",
      damageClass: "physical"
    }
  ];
}

/**
 * Limpa o cache (útil para testes ou quando necessário)
 */
export function clearCache() {
  pokemonMovesCache.clear();
  moveDetailsCache.clear();
}

