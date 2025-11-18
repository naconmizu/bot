import { SlashCommandBuilder } from "discord.js";
import { getPlayerBattle, attemptCapture, processOpponentAttack } from "./battleState.js";

export default {
  data: new SlashCommandBuilder()
    .setName("capturar")
    .setDescription("Tenta capturar um Pokémon selvagem!"),

  async execute(interaction) {
    const playerId = interaction.user.id;
    const battle = await getPlayerBattle(playerId);

    if (!battle) {
      return interaction.reply({
        content: "❌ Você não está em uma batalha! Use `/batalha` para iniciar uma.",
        ephemeral: true
      });
    }

    if (battle.battleType !== "wild") {
      return interaction.reply({
        content: "❌ Você só pode capturar Pokémon selvagens! Esta é uma batalha contra um treinador.",
        ephemeral: true
      });
    }

    if (battle.status !== "active") {
      return interaction.reply({
        content: "❌ Esta batalha já terminou!",
        ephemeral: true
      });
    }

    if (battle.currentTurn !== "player") {
      return interaction.reply({
        content: "⏳ Não é seu turno! Aguarde o oponente atacar.",
        ephemeral: true
      });
    }

    // Tenta capturar
    const captureResult = await attemptCapture(battle);

    if (captureResult.success) {
      return interaction.reply({
        content: captureResult.message + `\n\n${battle.npcPokemon.name} foi adicionado à sua coleção!`
      });
    } else {
      // Se falhou, o oponente ataca
      let responseMessage = captureResult.message + "\n\n";
      
      const opponentAttack = await processOpponentAttack(battle);
      if (opponentAttack.success) {
        responseMessage += opponentAttack.message + "\n";
        responseMessage += `\n**Status:**\n`;
        responseMessage += `${battle.playerPokemon.name}: ${battle.playerPokemon.hp}/${battle.playerPokemon.maxHP} HP\n`;
        responseMessage += `${battle.npcPokemon.name}: ${battle.npcPokemon.hp}/${battle.npcPokemon.maxHP} HP\n`;

        if (opponentAttack.battleEnded) {
          responseMessage += `\n💀 Você perdeu a batalha!`;
        } else {
          responseMessage += `\n💡 É seu turno! Use \`/atacar\` ou \`/capturar\` novamente.`;
        }
      }

      return interaction.reply({
        content: responseMessage
      });
    }
  }
};

