import { REST, Routes } from "discord.js";
import config from "../config.json" assert { type: "json" };
import { commands } from "./commands.js";

const rest = new REST({ version: "10" }).setToken(config.token);

try {
  console.log(`Started refreshing ${commands.size} application (/) commands.`);

  const data = await rest.put(Routes.applicationCommands(config.clientId), {
    body: Array.from(commands.values()).map((c) => c.data.toJSON()),
  });

  console.log(`Successfully reloaded ${data.length} application (/) commands.`);
} catch (error) {
  console.error(error);
}
