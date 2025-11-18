import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware
} from 'discord-interactions';

import 'dotenv/config';
import express from 'express';
import { connectDB } from './db.js';
import { getRandomEmoji } from './utils.js';
import { getPlayerPokemon, getPlayerPokemonList, createTrainerPokemon, createWildPokemon } from './battleUtils.js';
import { createBattle, getPlayerBattle, processPlayerAttack, processOpponentAttack, attemptCapture, processFlee, switchPokemon } from './battleState.js';
import { getPokemonSkills } from './pokemonSkills.js';
import Player from "./models/player.js";

// Connect DB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

const MOD_ROLE_ID = process.env.MOD_ROLE_ID;

// Helper function para editar resposta original
async function editOriginal(req, content) {
  const url = `https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
  const body = typeof content === 'string'
    ? { content }
    : content;

  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

// Helper function para verificar se usuário é mod
function isMod(member) {
  if (!member) return false;
  // Discord pode retornar roles como array ou objeto
  const roles = member.roles || [];
  if (Array.isArray(roles)) {
    return roles.includes(MOD_ROLE_ID);
  }
  // Se for objeto, verifica se a chave existe
  return roles[MOD_ROLE_ID] !== undefined;
}


app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { type, data, member } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }


  // Botões de paginação
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const custom = data.custom_id;

    if (custom.startsWith("skill_prev_") || custom.startsWith("skill_next_")) {
      const [, dir, indexStr] = custom.split("_");
      const pageIndex = parseInt(indexStr);

      const newPage = dir === "prev" ? pageIndex - 1 : pageIndex + 1;

      // limita dentro do range
      if (newPage < 0) newPage = 0;
      if (newPage >= pages.length) newPage = pages.length - 1;

      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: formatPage(newPage)
      });
    }
  }


  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // shows pokemons skills
    // /skills <pokemon>
    if (name === "pokemon") {
      const options = data?.options ?? [];
      const pokemonName = options[0]?.value?.toString().toLowerCase();

      // 1️⃣ Responde rápido
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      // 2️⃣ Continua o processamento sem bloquear a requisição
      (async () => {
        try {
          const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
          if (!response.ok) {
            // Edita via webhook
            await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: `Pokémon **${pokemonName}** não encontrado!`
              })
            });
            return;
          }

          const pokemon = await response.json();

          const types = pokemon.types.map(t => t.type.name).join(", ");
          // 1) pega uma lista pequena de golpes (os primeiros 4, por exemplo)
          const moveUrls = pokemon.moves.slice(0, 4).map(m => m.move.url);

          // 2) busca cada skill na API
          const moveDetails = await Promise.all(
            moveUrls.map(async url => {
              const res = await fetch(url);
              const move = await res.json();

              // pega descrição em inglês
              const description =
                move.flavor_text_entries
                  .filter(f => f.language.name === "en")
                  .pop()?.flavor_text
                  ?.replace(/\n|\f/g, " ") || "No description";

              return {
                name: move.name,
                type: move.type.name,
                power: move.power ?? "—",
                accuracy: move.accuracy ?? "—",
                pp: move.pp ?? "—",
                description
              };
            })
          );

          // formatar bonito pra embed
          const movesFormatted = moveDetails
            .map(m => `**${m.name.toUpperCase()}**  
        • Tipo: *${m.type}*  
        • Power: ${m.power}  
        • Accuracy: ${m.accuracy}  
        • PP: ${m.pp}  
        • Descrição: ${m.description}`)
            .join("\n\n");

          const stats = pokemon.stats
            .map(s => `• **${s.stat.name}:** ${s.base_stat}`)
            .join("\n");

          const height = (pokemon.height / 10).toFixed(1);
          const weight = (pokemon.weight / 10).toFixed(1);

          // 3️⃣ — EDITAR a resposta sem Express
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [
                {
                  title: `#${pokemon.id} — ${pokemon.name.toUpperCase()}`,
                  color: 0xffcb05,
                  thumbnail: { url: pokemon.sprites.front_default },
                  fields: [
                    { name: "Tipos", value: types, inline: true },
                    { name: "Altura", value: `${height} m`, inline: true },
                    { name: "Peso", value: `${weight} kg`, inline: true },
                    { name: "Skills (Moves)", value: movesFormatted, inline: false },
                    { name: "Stats", value: stats }
                  ],
                  footer: { text: "Pokédex — Powered by PokéAPI" }
                }
              ]
            })
          });

        } catch (e) {
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: "Erro ao buscar dados do Pokémon."
            })
          });
        }
      })();

      // 4️⃣ ENCERRA a requisição Express aqui
      return;
    }
    if (name === "skill") {
      const options = data?.options ?? [];
      const pokemonName = options[0]?.value?.toString().toLowerCase();

      // --- reply rápido
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          // ---- pega dados do Pokémon
          const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
          if (!response.ok) {
            await editOriginal(req, `Pokémon **${pokemonName}** não encontrado!`);
            return;
          }

          const pokemon = await response.json();

          // --- pega TODAS as skills
          const moveUrls = pokemon.moves.map(m => m.move.url);

          const moveDetails = await Promise.all(
            moveUrls.map(async url => {
              const r = await fetch(url);
              const move = await r.json();

              const description =
                move.flavor_text_entries.find(f => f.language.name === "en")?.flavor_text
                  ?.replace(/\n|\f/g, " ") || "No description";

              return {
                name: move.name,
                type: move.type.name,
                power: move.power ?? "—",
                accuracy: move.accuracy ?? "—",
                pp: move.pp ?? "—",
                description
              };
            })
          );

          // --- monta páginas de 5 skills
          const pageSize = 5;
          const pages = [];
          for (let i = 0; i < moveDetails.length; i += pageSize) {
            pages.push(moveDetails.slice(i, i + pageSize));
          }

          // cor baseada no tipo principal
          const mainType = pokemon.types[0].type.name;
          const typeColors = {
            normal: 0xA8A77A,
            fire: 0xEE8130,
            water: 0x6390F0,
            electric: 0xF7D02C,
            grass: 0x7AC74C,
            ice: 0x96D9D6,
            fighting: 0xC22E28,
            poison: 0xA33EA1,
            ground: 0xE2BF65,
            flying: 0xA98FF3,
            psychic: 0xF95587,
            bug: 0xA6B91A,
            rock: 0xB6A136,
            ghost: 0x735797,
            dragon: 0x6F35FC,
            dark: 0x705746,
            steel: 0xB7B7CE,
            fairy: 0xD685AD
          };

          function formatPage(pageIndex) {
            const movesText = pages[pageIndex]
              .map(m => `**${m.name.toUpperCase()}**  
• Tipo: *${m.type}*  
• Power: ${m.power}  
• Accuracy: ${m.accuracy}  
• PP: ${m.pp}  
• ${m.description}`)
              .join("\n\n");

            return {
              embeds: [
                {
                  title: `Skills de ${pokemon.name.toUpperCase()} — Página ${pageIndex + 1}/${pages.length}`,
                  color: typeColors[mainType] ?? 0xffffff,
                  fields: [
                    { name: "Golpes", value: movesText }
                  ],
                  footer: { text: "Pokédex — Powered by PokéAPI" }
                }
              ],
              components: [
                {
                  type: 1,
                  components: [
                    {
                      type: 2,
                      label: "◀",
                      style: 1,
                      custom_id: `skill_prev_${pageIndex}`
                    },
                    {
                      type: 2,
                      label: "▶",
                      style: 1,
                      custom_id: `skill_next_${pageIndex}`
                    }
                  ]
                }
              ]
            };
          }

          // envia página 1
          await editOriginal(req, formatPage(0));

        } catch (err) {
          await editOriginal(req, "Erro ao buscar dados do Pokémon.");
        }
      })();

      return;
    }







    // Comando de batalha
    if (name === "batalha") {
      const playerId = req.body.member?.user?.id || req.body.user?.id;
      if (!playerId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "❌ Erro ao identificar o jogador." }
        });
      }

      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          const activeBattle = await getPlayerBattle(playerId);
          if (activeBattle) {
            await editOriginal(req, `⚠️ Você já está em uma batalha! Use \`/atacar\` para continuar.`);
            return;
          }

          const options = data?.options ?? [];
          
          // Verificar se o jogador tem Pokémon
          const pokemonList = await getPlayerPokemonList(playerId);
          if (!pokemonList || pokemonList.length === 0) {
            await editOriginal(req, "❌ Você não possui Pokémon!");
            return;
          }

          // Obter Pokémon escolhido ou usar o primeiro
          const pokemonOption = options.find(opt => opt.name === "pokemon");
          let playerPokemon;
          
          if (pokemonOption) {
            const pokemonName = pokemonOption.value.toString();
            playerPokemon = await getPlayerPokemon(playerId, pokemonName);
            if (!playerPokemon) {
              await editOriginal(req, `❌ Você não possui um Pokémon chamado **${pokemonName}**!\n\nSeus Pokémon: ${pokemonList.map(p => p.name).join(", ")}`);
              return;
            }
          } else {
            // Se tem mais de um, DEVE escolher
            if (pokemonList.length > 1) {
              const pokemonNames = pokemonList.map((p, i) => `${i + 1}. **${p.name}** (Nível ${p.level}) - HP: ${p.hp}/${p.maxHP}`).join("\n");
              await editOriginal(req, `📋 **Você DEVE escolher um Pokémon para batalhar:**\n\n${pokemonNames}\n\n💡 Use \`/batalha pokemon:nome\` para escolher um Pokémon específico!`);
              return;
            }
            // Se tem apenas um, usar automaticamente
            playerPokemon = await getPlayerPokemon(playerId);
          }

          if (!playerPokemon) {
            await editOriginal(req, "❌ Erro ao selecionar Pokémon!");
            return;
          }

          const battleTypeOption = options.find(opt => opt.name === "tipo");
          const battleType = battleTypeOption?.value || (Math.random() < 0.5 ? "wild" : "trainer");

          let npcData;
          if (battleType === "wild") {
            npcData = createWildPokemon();
          } else {
            npcData = createTrainerPokemon();
          }

          // Obter todos os Pokémon para passar à batalha
          const playerData = await Player.findOne({ userId: playerId });
          const allPokemons = playerData?.Pokemons || [];
          
          const battle = await createBattle(playerId, playerPokemon, npcData, battleType, allPokemons);

          const battleTypeText = battleType === "wild" ? "Pokémon Selvagem" : "Treinador";
          const opponentName = battleType === "wild"
            ? `**${battle.npcPokemon.name}** (Nível ${battle.npcPokemon.level})`
            : `**${battle.npc}** com **${battle.npcPokemon.name}** (Nível ${battle.npcPokemon.level})`;

          // Obter skills disponíveis do Pokémon com PP
          const availableSkills = await getPokemonSkills(battle.playerPokemon.name);
          const skillNames = availableSkills.map(s => {
            const pp = (battle.skillPP && battle.skillPP[s.name]) || s.pp || 35;
            return `${s.name} (PP: ${pp}/${s.pp})`;
          }).join(", ");

          // Obter pokébolas do jogador
          let pokeballsInfo = "";
          if (battleType === "wild" && playerData?.Pokeballs) {
            let pokeballs = playerData.Pokeballs;
            if (pokeballs instanceof Map) {
              pokeballs = Object.fromEntries(pokeballs);
            }
            const pokeballsList = Object.entries(pokeballs)
              .filter(([_, count]) => count > 0)
              .map(([name, count]) => `**${name}**: ${count}`)
              .join(", ");
            if (pokeballsList) {
              pokeballsInfo = `\n🎾 **Pokébolas:** ${pokeballsList}`;
            }
          }

          const statusMessage = `🔥 **Batalha iniciada!** (${battleTypeText})

` +
            `Seu **${battle.playerPokemon.name}** (Nível ${battle.playerPokemon.level}) - HP: ${battle.playerPokemon.hp}/${battle.playerPokemon.maxHP}
` +
            `vs
` +
            `${opponentName} - HP: ${battle.npcPokemon.hp}/${battle.npcPokemon.maxHP}

` +
            `📋 **Skills disponíveis:** ${skillNames}${pokeballsInfo}

` +
            `💡 Use \`/atacar [skill:nome]\` para atacar!${battleType === "wild" ? " Ou use \`/capturar [pokebola:tipo]\` para tentar capturar!" : ""}`;

          await editOriginal(req, statusMessage);
        } catch (err) {
          console.error("Erro no comando batalha:", err);
          await editOriginal(req, "❌ Erro ao iniciar batalha.");
        }
      })();

      return;
    }

    // Comando de atacar
    if (name === "atacar") {
      const playerId = req.body.member?.user?.id || req.body.user?.id;
      if (!playerId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "❌ Erro ao identificar o jogador." }
        });
      }

      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          const battle = await getPlayerBattle(playerId);
          if (!battle) {
            await editOriginal(req, "❌ Você não está em uma batalha! Use \`/batalha\` para iniciar uma.");
            return;
          }

          if (battle.status !== "active") {
            await editOriginal(req, "❌ Esta batalha já terminou!");
            return;
          }

          if (battle.currentTurn !== "player") {
            await editOriginal(req, "⏳ Não é seu turno! Aguarde o oponente atacar.");
            return;
          }

          // Obter skill escolhida - skills são específicas do Pokémon em batalha
          const options = data?.options ?? [];
          const skillOption = options.find(opt => opt.name === "skill");
          const skillName = skillOption ? skillOption.value.toString() : null;

          // Obter skills disponíveis do Pokémon específico em batalha
          const availableSkills = getPokemonSkills(battle.playerPokemon.name);
          
          // Se não especificou skill, usar a primeira disponível
          let skillToUse = skillName;
          if (!skillToUse) {
            skillToUse = availableSkills[0]?.name || null;
          } else {
            // Validar se a skill existe para este Pokémon
            const skillExists = availableSkills.some(s => s.name === skillToUse);
            if (!skillExists) {
              const skillNames = availableSkills.map(s => s.name).join(", ");
              await editOriginal(req, `❌ **${skillToUse}** não está disponível para **${battle.playerPokemon.name}**!\n\n💡 Skills disponíveis: ${skillNames}`);
              return;
            }
          }

          const attackResult = await processPlayerAttack(battle, skillToUse);

          if (!attackResult.success) {
            await editOriginal(req, attackResult.message);
            return;
          }

          let responseMessage = attackResult.message + "\n\n";
          responseMessage += `**Status da Batalha:**\n`;
          responseMessage += `${battle.playerPokemon.name}: ${battle.playerPokemon.hp}/${battle.playerPokemon.maxHP} HP\n`;
          responseMessage += `${battle.npcPokemon.name}: ${battle.npcPokemon.hp}/${battle.npcPokemon.maxHP} HP\n`;

          if (!attackResult.battleEnded) {
            const opponentAttack = await processOpponentAttack(battle);

            if (opponentAttack.success) {
              responseMessage += `
${opponentAttack.message}
`;
              responseMessage += `
**Status após ataque do oponente:**
`;
              responseMessage += `${battle.playerPokemon.name}: ${battle.playerPokemon.hp}/${battle.playerPokemon.maxHP} HP
`;
              responseMessage += `${battle.npcPokemon.name}: ${battle.npcPokemon.hp}/${battle.npcPokemon.maxHP} HP
`;

              if (opponentAttack.battleEnded) {
                responseMessage += `
💀 Você perdeu a batalha!`;
              } else if (opponentAttack.needSwitch) {
                // Precisa trocar de Pokémon
                const player = await Player.findOne({ userId: playerId });
                const availablePokemons = opponentAttack.availablePokemons.map(idx => {
                  const p = player.Pokemons[idx];
                  return `${idx + 1}. **${p.name}** (Nível ${p.level}) - HP: ${p.hp}/${p.maxHP}`;
                }).join("\n");
                responseMessage += `\n\n📋 **Escolha um Pokémon para continuar:**\n${availablePokemons}\n\n💡 Use \`/trocar pokemon:nome\` para escolher!`;
              } else {
                const availableSkills = await getPokemonSkills(battle.playerPokemon.name);
                const skillNames = availableSkills.map(s => {
                  const pp = (battle.skillPP && battle.skillPP[s.name]) || s.pp || 35;
                  return `${s.name} (PP: ${pp}/${s.pp})`;
                }).join(", ");
                responseMessage += `
💡 É seu turno! Use \`/atacar\` novamente.\n📋 Skills disponíveis: ${skillNames}`;
              }
            }
          } else {
            responseMessage += `
✨ Você ganhou ${battle.xpReward} XP!`;
            if (battle.battleType === "wild") {
              responseMessage += `
💡 Em batalhas selvagens, você pode usar \`/capturar\` durante a batalha!`;
            }
          }

          await editOriginal(req, responseMessage);
        } catch (err) {
          console.error("Erro no comando atacar:", err);
          await editOriginal(req, "❌ Erro ao processar ataque.");
        }
      })();

      return;
    }

    // Comando de capturar
    if (name === "capturar") {
      const playerId = req.body.member?.user?.id || req.body.user?.id;
      if (!playerId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "❌ Erro ao identificar o jogador." }
        });
      }

      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          const battle = await getPlayerBattle(playerId);
          if (!battle) {
            await editOriginal(req, "❌ Você não está em uma batalha! Use \`/batalha\` para iniciar uma.");
            return;
          }

          if (battle.battleType !== "wild") {
            await editOriginal(req, "❌ Você só pode capturar Pokémon selvagens! Esta é uma batalha contra um treinador.");
            return;
          }

          if (battle.status !== "active") {
            await editOriginal(req, "❌ Esta batalha já terminou!");
            return;
          }

          if (battle.currentTurn !== "player") {
            await editOriginal(req, "⏳ Não é seu turno! Aguarde o oponente atacar.");
            return;
          }

          // Obter pokébola escolhida
          const options = data?.options ?? [];
          const pokeballOption = options.find(opt => opt.name === "pokebola");
          const pokeballName = pokeballOption ? pokeballOption.value.toString() : "Pokébola";

          const captureResult = await attemptCapture(battle, pokeballName);

          if (captureResult.success) {
            await editOriginal(req, captureResult.message + `\n\n${battle.npcPokemon.name} foi adicionado à sua coleção!`);
          } else {
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

            await editOriginal(req, responseMessage);
          }
        } catch (err) {
          console.error("Erro no comando capturar:", err);
          await editOriginal(req, "❌ Erro ao tentar capturar.");
        }
      })();

      return;
    }

    // Comando de fugir
    if (name === "fugir") {
      const playerId = req.body.member?.user?.id || req.body.user?.id;
      if (!playerId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "❌ Erro ao identificar o jogador." }
        });
      }

      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          const battle = await getPlayerBattle(playerId);
          if (!battle) {
            await editOriginal(req, "❌ Você não está em uma batalha! Use `/batalha` para iniciar uma.");
            return;
          }

          const fleeResult = await processFlee(battle);

          if (fleeResult.success) {
            await editOriginal(req, fleeResult.message);
          } else {
            let responseMessage = fleeResult.message + "\n\n";
            
            if (fleeResult.opponentAttack && fleeResult.opponentAttack.success) {
              responseMessage += fleeResult.opponentAttack.message + "\n";
              responseMessage += `\n**Status:**\n`;
              responseMessage += `${battle.playerPokemon.name}: ${battle.playerPokemon.hp}/${battle.playerPokemon.maxHP} HP\n`;
              responseMessage += `${battle.npcPokemon.name}: ${battle.npcPokemon.hp}/${battle.npcPokemon.maxHP} HP\n`;

              if (fleeResult.opponentAttack.battleEnded) {
                responseMessage += `\n💀 Você perdeu a batalha!`;
              } else {
                responseMessage += `\n💡 É seu turno! Use \`/atacar\` ou \`/fugir\` novamente.`;
              }
            }

            await editOriginal(req, responseMessage);
          }
        } catch (err) {
          console.error("Erro no comando fugir:", err);
          await editOriginal(req, "❌ Erro ao tentar fugir.");
        }
      })();

      return;
    }

    // Comando de dar Pokémon (apenas mods)
    if (name === "givepokemon") {
      // Verificação de permissão - usar member do req.body caso não esteja disponível
      const memberData = member || req.body.member;
      if (!isMod(memberData)) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Você não tem permissão para usar este comando! Apenas moderadores podem dar Pokémon.",
            flags: InteractionResponseFlags.EPHEMERAL
          }
        });
      }

      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          const options = data?.options ?? [];
          const userOption = options.find(opt => opt.name === "usuario");
          const pokemonOption = options.find(opt => opt.name === "pokemon");
          const levelOption = options.find(opt => opt.name === "nivel");

          if (!userOption || !pokemonOption) {
            await editOriginal(req, "❌ Erro: Usuário e Pokémon são obrigatórios!");
            return;
          }

          const userId = userOption.value.toString();
          const pokemonName = pokemonOption.value.toString();
          const level = levelOption ? parseInt(levelOption.value) || 1 : 1;

          // Buscar ou criar player
          let player = await Player.findOne({ userId });
          if (!player) {
            player = await Player.create({
              userId,
              Pokemons: [],
              Level: 1,
              XP: 0
            });
          }

          // Verificar se já possui o Pokémon
          const pokemonExists = player.Pokemons.some(p => 
            p.name && p.name.toLowerCase() === pokemonName.toLowerCase()
          );

          if (pokemonExists) {
            await editOriginal(req, `⚠️ O jogador <@${userId}> já possui **${pokemonName}**!`);
            return;
          }

          // Criar objeto Pokemon completo
          const baseHP = 50; // HP base padrão
          const pokemonData = {
            name: pokemonName,
            hp: baseHP + (level * 2),
            maxHP: baseHP + (level * 2),
            level: level,
            xp: 0
          };

          // Adicionar Pokémon
          if (!player.Pokemons) {
            player.Pokemons = [];
          }
          player.Pokemons.push(pokemonData);
          await player.save();

          await editOriginal(req, `✅ Pokémon **${pokemonName}** (Nível ${level}) foi adicionado ao jogador <@${userId}>!`);
        } catch (err) {
          console.error("Erro no comando givePokemon:", err);
          await editOriginal(req, "❌ Erro ao dar Pokémon. Verifique os parâmetros e tente novamente.");
        }
      })();

      return;
    }

    // Comando de remover Pokémon (apenas mods)
    if (name === "removepokemon") {
      const memberData = member || req.body.member;
      if (!isMod(memberData)) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Você não tem permissão para usar este comando! Apenas moderadores podem remover Pokémon.",
            flags: InteractionResponseFlags.EPHEMERAL
          }
        });
      }

      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          const options = data?.options ?? [];
          const userOption = options.find(opt => opt.name === "usuario");
          const pokemonOption = options.find(opt => opt.name === "pokemon");

          if (!userOption || !pokemonOption) {
            await editOriginal(req, "❌ Erro: Usuário e Pokémon são obrigatórios!");
            return;
          }

          const userId = userOption.value.toString();
          const pokemonName = pokemonOption.value.toString();

          const player = await Player.findOne({ userId });
          if (!player || !player.Pokemons || player.Pokemons.length === 0) {
            await editOriginal(req, `❌ O jogador <@${userId}> não possui Pokémon!`);
            return;
          }

          // Encontrar e remover o Pokémon
          const pokemonIndex = player.Pokemons.findIndex(p => 
            p.name && p.name.toLowerCase() === pokemonName.toLowerCase()
          );

          if (pokemonIndex === -1) {
            await editOriginal(req, `❌ O jogador <@${userId}> não possui **${pokemonName}**!`);
            return;
          }

          const removedPokemon = player.Pokemons[pokemonIndex];
          player.Pokemons.splice(pokemonIndex, 1);
          await player.save();

          await editOriginal(req, `✅ Pokémon **${removedPokemon.name}** foi removido do jogador <@${userId}>!`);
        } catch (err) {
          console.error("Erro no comando removePokemon:", err);
          await editOriginal(req, "❌ Erro ao remover Pokémon. Verifique os parâmetros e tente novamente.");
        }
      })();

      return;
    }

    // Comando de dar XP (apenas mods)
    if (name === "givexp") {
      const memberData = member || req.body.member;
      if (!isMod(memberData)) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Você não tem permissão para usar este comando! Apenas moderadores podem dar XP.",
            flags: InteractionResponseFlags.EPHEMERAL
          }
        });
      }

      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          const options = data?.options ?? [];
          const userOption = options.find(opt => opt.name === "usuario");
          const xpOption = options.find(opt => opt.name === "xp");
          const pokemonOption = options.find(opt => opt.name === "pokemon");

          if (!userOption || !xpOption) {
            await editOriginal(req, "❌ Erro: Usuário e XP são obrigatórios!");
            return;
          }

          const userId = userOption.value.toString();
          const xpAmount = parseInt(xpOption.value) || 0;
          const pokemonName = pokemonOption ? pokemonOption.value.toString() : null;

          if (xpAmount <= 0) {
            await editOriginal(req, "❌ A quantidade de XP deve ser maior que 0!");
            return;
          }

          const player = await Player.findOne({ userId });
          if (!player || !player.Pokemons || player.Pokemons.length === 0) {
            await editOriginal(req, `❌ O jogador <@${userId}> não possui Pokémon!`);
            return;
          }

          // Se especificou pokemon, dar XP apenas para ele, senão dar para o primeiro
          if (pokemonName) {
            const pokemon = player.Pokemons.find(p => 
              p.name && p.name.toLowerCase() === pokemonName.toLowerCase()
            );

            if (!pokemon) {
              await editOriginal(req, `❌ O jogador <@${userId}> não possui **${pokemonName}**!`);
              return;
            }

            pokemon.xp = (pokemon.xp || 0) + xpAmount;
            
            // Verifica level up (100 XP por nível)
            const newLevel = Math.floor(pokemon.xp / 100) + 1;
            const oldLevel = pokemon.level || 1;
            if (newLevel > oldLevel) {
              pokemon.level = newLevel;
              pokemon.maxHP = (pokemon.maxHP || 50) + 10;
              pokemon.hp = pokemon.maxHP;
            }

            await player.save();
            await editOriginal(req, `✅ **${xpAmount} XP** foi adicionado ao **${pokemon.name}** (Nível ${pokemon.level}) do jogador <@${userId}>!${newLevel > oldLevel ? `\n🎉 **${pokemon.name}** subiu para o nível ${newLevel}!` : ""}`);
          } else {
            // Dar XP para o primeiro Pokémon
            const pokemon = player.Pokemons[0];
            pokemon.xp = (pokemon.xp || 0) + xpAmount;
            
            const newLevel = Math.floor(pokemon.xp / 100) + 1;
            const oldLevel = pokemon.level || 1;
            if (newLevel > oldLevel) {
              pokemon.level = newLevel;
              pokemon.maxHP = (pokemon.maxHP || 50) + 10;
              pokemon.hp = pokemon.maxHP;
            }

            await player.save();
            await editOriginal(req, `✅ **${xpAmount} XP** foi adicionado ao **${pokemon.name}** (Nível ${pokemon.level}) do jogador <@${userId}>!${newLevel > oldLevel ? `\n🎉 **${pokemon.name}** subiu para o nível ${newLevel}!` : ""}`);
          }
        } catch (err) {
          console.error("Erro no comando giveXP:", err);
          await editOriginal(req, "❌ Erro ao dar XP. Verifique os parâmetros e tente novamente.");
        }
      })();

      return;
    }

    // Comando de trocar Pokémon
    if (name === "trocar") {
      const playerId = req.body.member?.user?.id || req.body.user?.id;
      if (!playerId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "❌ Erro ao identificar o jogador." }
        });
      }

      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          const battle = await getPlayerBattle(playerId);
          if (!battle) {
            await editOriginal(req, "❌ Você não está em uma batalha! Use `/batalha` para iniciar uma.");
            return;
          }

          const options = data?.options ?? [];
          const pokemonOption = options.find(opt => opt.name === "pokemon");
          
          if (!pokemonOption) {
            await editOriginal(req, "❌ Você deve especificar qual Pokémon usar!");
            return;
          }

          const pokemonName = pokemonOption.value.toString();
          const player = await Player.findOne({ userId: playerId });
          
          // Encontrar índice do Pokémon
          const pokemonIndex = player.Pokemons.findIndex(p => 
            p.name && p.name.toLowerCase() === pokemonName.toLowerCase()
          );

          if (pokemonIndex === -1) {
            await editOriginal(req, `❌ Você não possui um Pokémon chamado **${pokemonName}**!`);
            return;
          }

          const switchResult = await switchPokemon(battle, pokemonIndex);
          
          if (!switchResult.success) {
            await editOriginal(req, switchResult.message);
            return;
          }

          // Mostrar skills do novo Pokémon
          const availableSkills = await getPokemonSkills(switchResult.pokemon.name);
          const skillNames = availableSkills.map(s => {
            const pp = (battle.skillPP && battle.skillPP[s.name]) || s.pp || 35;
            return `${s.name} (PP: ${pp}/${s.pp})`;
          }).join(", ");

          await editOriginal(req, switchResult.message + `\n\n📋 **Skills disponíveis:** ${skillNames}\n\n💡 Use \`/atacar\` para continuar!`);
        } catch (err) {
          console.error("Erro no comando trocar:", err);
          await editOriginal(req, "❌ Erro ao trocar Pokémon.");
        }
      })();

      return;
    }

    // Comando de dar pokébola (apenas mods)
    if (name === "givepokeball") {
      const memberData = member || req.body.member;
      if (!isMod(memberData)) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Você não tem permissão para usar este comando! Apenas moderadores podem dar pokébolas.",
            flags: InteractionResponseFlags.EPHEMERAL
          }
        });
      }

      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      (async () => {
        try {
          const options = data?.options ?? [];
          const userOption = options.find(opt => opt.name === "usuario");
          const pokeballOption = options.find(opt => opt.name === "pokebola");
          const quantidadeOption = options.find(opt => opt.name === "quantidade");

          if (!userOption || !pokeballOption) {
            await editOriginal(req, "❌ Erro: Usuário e tipo de pokébola são obrigatórios!");
            return;
          }

          const userId = userOption.value.toString();
          const pokeballName = pokeballOption.value.toString();
          const quantidade = quantidadeOption ? parseInt(quantidadeOption.value) || 1 : 1;

          if (quantidade <= 0) {
            await editOriginal(req, "❌ A quantidade deve ser maior que 0!");
            return;
          }

          const player = await Player.findOne({ userId });
          if (!player) {
            await editOriginal(req, `❌ Jogador <@${userId}> não encontrado!`);
            return;
          }

          // Converter Map para objeto se necessário
          let pokeballs = player.Pokeballs;
          if (pokeballs instanceof Map) {
            pokeballs = Object.fromEntries(pokeballs);
          } else if (!pokeballs || typeof pokeballs !== 'object') {
            pokeballs = {};
          }

          // Adicionar pokébolas
          pokeballs[pokeballName] = (pokeballs[pokeballName] || 0) + quantidade;
          player.Pokeballs = pokeballs;
          await player.save();

          await editOriginal(req, `✅ **${quantidade} ${pokeballName}(s)** foi(ram) adicionada(s) ao jogador <@${userId}>!`);
        } catch (err) {
          console.error("Erro no comando givePokeball:", err);
          await editOriginal(req, "❌ Erro ao dar pokébola. Verifique os parâmetros e tente novamente.");
        }
      })();

      return;
    }

    return res.status(400).json({ error: 'unknown command' });
  }

  return res.status(400).json({ error: 'unknown interaction type' });
});

//ta aq pq da problema no endpoint de cima
app.use(express.json());


app.get('/', (req, res) => {
  res.send("Bot rodando");
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
