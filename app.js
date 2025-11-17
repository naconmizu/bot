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
      const pokemonName = options[0]?.value?.toString().toLowerCase();

      // 1️⃣ Responder rápido (pra não dar timeout)
      await res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      try {
        // 2️⃣ Buscar dados da PokéAPI
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);

        if (!response.ok) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `Pokémon **${pokemonName}** não encontrado!` }
          });
        }

        const pokemon = await response.json();

        const types = pokemon.types.map(t => t.type.name).join(", ");
        const abilities = pokemon.abilities
          .map(a => `• ${a.ability.name}${a.is_hidden ? " *(Hidden)*" : ""}`)
          .join("\n");
        const stats = pokemon.stats
          .map(s => `• **${s.stat.name}:** ${s.base_stat}`)
          .join("\n");

        const height = (pokemon.height / 10).toFixed(1);
        const weight = (pokemon.weight / 10).toFixed(1);

        // 3️⃣ EDITAR a resposta com o embed completo
        return res.send({
          type: InteractionResponseType.EDIT_ORIGINAL_RESPONSE,
          data: {
            embeds: [
              {
                title: `#${pokemon.id} — ${pokemon.name.toUpperCase()}`,
                color: 0xffcb05,
                thumbnail: { url: pokemon.sprites.front_default },
                fields: [
                  { name: "Tipos", value: types, inline: true },
                  { name: "Altura", value: `${height} m`, inline: true },
                  { name: "Peso", value: `${weight} kg`, inline: true },
                  { name: "Habilidades", value: abilities },
                  { name: "Stats", value: stats }
                ],
                footer: { text: "Pokédex — Powered by PokéAPI" }
              }
            ]
          }
        });

      } catch (err) {
        return res.send({
          type: InteractionResponseType.EDIT_ORIGINAL_RESPONSE,
          data: { content: "Erro ao buscar dados do Pokémon." }
        });
      }
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
