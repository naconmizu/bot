import { SlashCommandBuilder } from "discord.js";
import { getPlayerPokemon, createTrainerPokemon, createWildPokemon } from "./battleUtils.js";
import { createBattle, getPlayerBattle } from "./battleState.js";

export default {
  data: new SlashCommandBuilder()
    .setName("batalha")
    .setDescription("Inicia uma batalha!")
    .addStringOption(option =>
      option
        .setName("tipo")
        .setDescription("Tipo de batalha")
        .setRequired(false)
        .addChoices(
          { name: "Treinador", value: "trainer" },
          { name: "Pokémon Selvagem", value: "wild" }
        )),

  async execute(interaction) {
    const playerId = interaction.user.id;
    
    // Verifica se já existe uma batalha ativa
    const activeBattle = await getPlayerBattle(playerId);
    if (activeBattle) {
      return interaction.reply({
        content: `⚠️ Você já está em uma batalha! Use \`/atacar\` para continuar.`,
        ephemeral: true
      });
    }

    const playerPokemon = await getPlayerPokemon(playerId);
    if (!playerPokemon) {
      return interaction.reply({
        content: "❌ Você não possui Pokémon!",
        ephemeral: true
      });
    }

    const battleType = interaction.options.getString("tipo") || (Math.random() < 0.5 ? "wild" : "trainer");
    
    let npcData;
    if (battleType === "wild") {
      npcData = createWildPokemon();
    } else {
      npcData = createTrainerPokemon();
    }

    const battle = await createBattle(playerId, playerPokemon, npcData, battleType);

    const battleTypeText = battleType === "wild" ? "Pokémon Selvagem" : "Treinador";
    const opponentName = battleType === "wild" 
      ? `**${battle.npcPokemon.name}** (Nível ${battle.npcPokemon.level})`
      : `**${battle.npc}** com **${battle.npcPokemon.name}** (Nível ${battle.npcPokemon.level})`;

    const statusMessage = `🔥 **Batalha iniciada!** (${battleTypeText})\n\n` +
      `Seu **${battle.playerPokemon.name}** (Nível ${battle.playerPokemon.level}) - HP: ${battle.playerPokemon.hp}/${battle.playerPokemon.maxHP}\n` +
      `vs\n` +
      `${opponentName} - HP: ${battle.npcPokemon.hp}/${battle.npcPokemon.maxHP}\n\n` +
      `💡 Use \`/atacar\` para atacar!${battleType === "wild" ? " Ou use \`/capturar\` para tentar capturar!" : ""}`;

    return interaction.reply({
      content: statusMessage
    });
  }
};
