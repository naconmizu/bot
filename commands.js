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



const ALL_COMMANDS = [TEST_COMMAND, POKEMON_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
