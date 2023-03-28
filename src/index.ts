import {
  Client,
  REST as DiscordRest,
  Routes as DiscordRoutes,
  Events,
  GatewayIntentBits,
} from "discord.js";
import { config, environment } from "./utils.js";
import { commands, commandsMap } from "./commands/index.js";

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

const discordRest = new DiscordRest({ version: "10" }).setToken(config.token);
discordRest
  .put(DiscordRoutes.applicationCommands(config.clientId), {
    body: commands.map((c) => c.data.toJSON()),
  })
  .then(() => console.log("Updated commands"));

console.log(`Running in \`${environment}\` mode.`);
client.once(Events.ClientReady, async () => {
  console.log("Connected!");
  const url = (await client.guilds.fetch())
    .get(config.serverId)
    ?.iconURL({ size: 4096 });
  if (url) await client.user?.setAvatar(url);
});
client.login(config.token);

client.on(Events.InteractionCreate, (interaction) => {
  if (interaction.isChatInputCommand())
    return commandsMap
      .get(interaction.commandName)
      ?.execute(interaction, client);

  return;
});
