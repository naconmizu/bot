import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';



// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};


const POKEMON_COMMAND = {
  name: "pokemon",
  description: "Mostra informações completas de um Pokémon",
  options: [
    {
      name: "pokemon",
      description: "Nome ou ID do Pokémon",
      type: 3, // STRING
      required: true
    }
  ]
}

const BATALHA_COMMAND = {
  name: "batalha",
  description: "Inicia uma batalha!",
  options: [
    {
      name: "tipo",
      description: "Tipo de batalha",
      type: 3, // STRING
      required: false,
      choices: [
        { name: "Treinador", value: "trainer" },
        { name: "Pokémon Selvagem", value: "wild" }
      ]
    },
    {
      name: "pokemon",
      description: "Pokémon a usar na batalha (opcional)",
      type: 3, // STRING
      required: false
    }
  ]
}

const ATACAR_COMMAND = {
  name: "atacar",
  description: "Ataca o oponente na batalha atual!",
  options: [
    {
      name: "skill",
      description: "Skill/Move a usar (opcional)",
      type: 3, // STRING
      required: false
    }
  ]
}

const CAPTURAR_COMMAND = {
  name: "capturar",
  description: "Tenta capturar um Pokémon selvagem!",
  options: [
    {
      name: "pokebola",
      description: "Tipo de pokébola a usar (padrão: Pokébola)",
      type: 3, // STRING
      required: false,
      choices: [
        { name: "Pokébola", value: "Pokébola" },
        { name: "Super Bola", value: "Super Bola" },
        { name: "Ultra Bola", value: "Ultra Bola" },
        { name: "Master Bola", value: "Master Bola" }
      ]
    }
  ]
}

const FUGIR_COMMAND = {
  name: "fugir",
  description: "Tenta fugir da batalha atual!"
}

const TROCAR_COMMAND = {
  name: "trocar",
  description: "Troca de Pokémon durante a batalha",
  options: [
    {
      name: "pokemon",
      description: "Nome do Pokémon para usar",
      type: 3, // STRING
      required: true
    }
  ]
}

const GIVEPOKEMON_COMMAND = {
  name: "givepokemon",
  description: "[MOD] Dá um Pokémon para um jogador",
  options: [
    {
      name: "usuario",
      description: "Usuário que receberá o Pokémon",
      type: 6, // USER
      required: true
    },
    {
      name: "pokemon",
      description: "Nome do Pokémon",
      type: 3, // STRING
      required: true
    },
    {
      name: "nivel",
      description: "Nível do Pokémon (padrão: 1)",
      type: 4, // INTEGER
      required: false
    }
  ]
}

const REMOVEPOKEMON_COMMAND = {
  name: "removepokemon",
  description: "[MOD] Remove um Pokémon de um jogador",
  options: [
    {
      name: "usuario",
      description: "Usuário que terá o Pokémon removido",
      type: 6, // USER
      required: true
    },
    {
      name: "pokemon",
      description: "Nome do Pokémon a remover",
      type: 3, // STRING
      required: true
    }
  ]
}

const GIVEXP_COMMAND = {
  name: "givexp",
  description: "[MOD] Dá XP para um Pokémon de um jogador",
  options: [
    {
      name: "usuario",
      description: "Usuário que receberá o XP",
      type: 6, // USER
      required: true
    },
    {
      name: "xp",
      description: "Quantidade de XP",
      type: 4, // INTEGER
      required: true
    },
    {
      name: "pokemon",
      description: "Nome do Pokémon (opcional, padrão: primeiro Pokémon)",
      type: 3, // STRING
      required: false
    }
  ]
}

const GIVEPOKEBALL_COMMAND = {
  name: "givepokeball",
  description: "[MOD] Dá pokébolas para um jogador",
  options: [
    {
      name: "usuario",
      description: "Usuário que receberá as pokébolas",
      type: 6, // USER
      required: true
    },
    {
      name: "pokebola",
      description: "Tipo de pokébola",
      type: 3, // STRING
      required: true,
      choices: [
        { name: "Pokébola", value: "Pokébola" },
        { name: "Super Bola", value: "Super Bola" },
        { name: "Ultra Bola", value: "Ultra Bola" },
        { name: "Master Bola", value: "Master Bola" }
      ]
    },
    {
      name: "quantidade",
      description: "Quantidade de pokébolas (padrão: 1)",
      type: 4, // INTEGER
      required: false
    }
  ]
}

const ALL_COMMANDS = [
  TEST_COMMAND, 
  POKEMON_COMMAND, 
  BATALHA_COMMAND, 
  ATACAR_COMMAND, 
  CAPTURAR_COMMAND, 
  FUGIR_COMMAND,
  TROCAR_COMMAND,
  GIVEPOKEMON_COMMAND, 
  REMOVEPOKEMON_COMMAND, 
  GIVEXP_COMMAND,
  GIVEPOKEBALL_COMMAND
];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
