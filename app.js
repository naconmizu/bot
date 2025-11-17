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
                    { name: "Skills (Moves)", value: movesFormatted },
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
F