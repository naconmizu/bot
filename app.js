import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware
} from 'discord-interactions';

import 'dotenv/config';
import express from 'express';
import { getRandomEmoji } from './utils.js';
import { getPlayerLife } from './rpg.js';
import { connectDB } from './db.js';

// Connect DB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Parse body
app.use(express.json());

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

    if (name === 'life') {
      const userId = member.user.id;

      const bar = await getPlayerLife(userId);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `❤️ Sua vida:\n${bar}`
            }
          ]
        },
      });
    }

    return res.status(400).json({ error: 'unknown command' });
  }

  return res.status(400).json({ error: 'unknown interaction type' });
});

app.get('/', (req, res) => {
  res.send("Bot rodando");
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
