import { SlashCommandBuilder } from "discord.js";
import { getPlayerBattle, processPlayerAttack, processOpponentAttack } from "./battleState.js";

export default {
  data: new SlashCommandBuilder()
    .setName("atacar")
    .setDescription("Ataca o oponente na batalha atual!"),

  async execute(interaction) {
    const playerId = interaction.user.id;
    const battle = await getPlayerBattle(playerId);

    if (!battle) {
      return interaction.reply({
        content: "❌ Você não está em uma batalha! Use `/batalha` para iniciar uma.",
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

    // Processa ataque do jogador
    const attackResult = await processPlayerAttack(battle);
    
    if (!attackResult.success) {
      return interaction.reply({
        content: attackResult.message,
        ephemeral: true
      });
    }

    let responseMessage = attackResult.message + "\n\n";
    
    // Mostra status atualizado
    responseMessage += `**Status da Batalha:**\n`;
    responseMessage += `${battle.playerPokemon.name}: ${battle.playerPokemon.hp}/${battle.playerPokemon.maxHP} HP\n`;
    responseMessage += `${battle.npcPokemon.name}: ${battle.npcPokemon.hp}/${battle.npcPokemon.maxHP} HP\n`;

    // Se a batalha não terminou, processa ataque do oponente
    if (!attackResult.battleEnded) {
      // Aguarda um pouco antes do ataque do oponente (simulação)
      const opponentAttack = await processOpponentAttack(battle);
      
      if (opponentAttack.success) {
        responseMessage += `\n${opponentAttack.message}\n`;
        responseMessage += `\n**Status após ataque do oponente:**\n`;
        responseMessage += `${battle.playerPokemon.name}: ${battle.playerPokemon.hp}/${battle.playerPokemon.maxHP} HP\n`;
        responseMessage += `${battle.npcPokemon.name}: ${battle.npcPokemon.hp}/${battle.npcPokemon.maxHP} HP\n`;

        if (opponentAttack.battleEnded) {
          responseMessage += `\n💀 Você perdeu a batalha!`;
        } else {
          responseMessage += `\n💡 É seu turno! Use \`/atacar\` novamente.`;
        }
      }
    } else {
      // Batalha terminou com vitória do jogador
      responseMessage += `\n✨ Você ganhou ${battle.xpReward} XP!`;
      if (battle.battleType === "wild") {
        responseMessage += `\n💡 Em batalhas selvagens, você pode usar \`/capturar\` durante a batalha!`;
      }
    }

    return interaction.reply({
      content: responseMessage
    });
  }
};

