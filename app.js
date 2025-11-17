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

// Connect DB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;


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
