import { Client, Events, GatewayIntentBits } from "discord.js";
import {
  replyOrFollowUp,
  generateChatGPTResponse,
  generateChatGPTContext,
} from "./utils.js";
import _ from "lodash";
import config from "../config.json" assert { type: "json" };
import { commands } from "./commands.js";
import fs from "fs/promises";
import path from "path";
import { __dirname } from "./utils.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once(Events.ClientReady, () => {
  console.log("Ready!");
});

client.on(Events.MessageCreate, async (initialMessage) => {
  console.log(initialMessage.mentions);
  if (initialMessage.author.bot) return;
  if (!initialMessage.mentions.has(config.clientId)) return;
  const threadTitle = (
    await generateChatGPTResponse([
      {
        role: "user",
        content:
          "What would be a good title for a thread about the following question less than 100 characters long?\n" +
          initialMessage.content
            .replace(/<@.*?>/g, "")
            .replace(/\*+(.*?)\*+/g, "$1")
            .trim(),
      },
    ])
  ).replaceAll('"', "");

  const thread = await initialMessage.startThread({
    name: threadTitle,
    autoArchiveDuration: 60,
  });
  const collector = thread.createMessageCollector();

  const messages = [
    {
      role: "system",
      content: await generateChatGPTContext(initialMessage.guild),
    },
    { role: "user", content: initialMessage.content },
  ];

  const addAIResponse = _.debounce(async () => {
    thread.sendTyping();
    const message = await generateChatGPTResponse(messages);
    messages.push({ role: "assistant", content: message });
    await thread.send(message);
  }, 1000);

  addAIResponse();

  collector.on("collect", (message) => {
    if (message.author.id === config.clientId) return;
    messages.push({
      role: "user",
      content: message.content,
    });
    addAIResponse();
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const [kind, ...args] = interaction.customId.split(":");
  switch (kind) {
    case "transcript-conversation": {
      const [recordingId] = args;
      const transcriptPath = path.join(
        __dirname,
        "..",
        "transcripts",
        recordingId
      );
      const transcriptText = (
        await fs.readFile(transcriptPath + ".txt")
      ).toString();
      const transcriptData = JSON.parse(
        (await fs.readFile(transcriptPath + ".json")).toString()
      );
      const thread = await (
        await interaction.channel.parent.send(
          `What questions do you have about the meeting from ${new Date(
            transcriptData.startTime
          ).toDateString()}?`
        )
      ).startThread({
        name: `Discussion about meeting from ${new Date(
          transcriptData.startTime
        ).toDateString()}`,
      });
      interaction.reply({
        content: `Come chat with me in <#${thread.id}>`,
        ephemeral: true,
      });
      const collector = thread.createMessageCollector();

      const messages = [
        {
          role: "system",
          content:
            (await generateChatGPTContext(interaction.guild)) +
            `\n\nYour task is to answer questions about the meeting from ${new Date(
              transcriptData.startTime
            ).toDateString()}. Here is its transcript, you shall use it to answer the questions:\n${transcriptText}`,
        },
        {
          role: "assistant",
          content: `What questions do you have about the meeting from ${new Date(
            transcriptData.startTime
          ).toDateString()}`,
        },
      ];

      const addAIResponse = _.debounce(async () => {
        thread.sendTyping();
        const message = await generateChatGPTResponse(messages);
        messages.push({ role: "assistant", content: message });
        await thread.send(message);
      }, 1000);

      collector.on("collect", (message) => {
        if (message.author.id === config.clientId) return;
        messages.push({
          role: "user",
          content: message.content,
        });
        addAIResponse();
      });

      break;
    }
    default:
      break;
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.member.user.bot) return;

  const command = commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    try {
      await replyOrFollowUp(interaction, {
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
    }
  }
});

client.login(config.token);
