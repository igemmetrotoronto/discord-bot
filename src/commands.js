import path from "path";
import { Collection } from "discord.js";
import fs from "fs/promises";
import { __dirname } from "./utils.js";

export const commandsPath = path.join(__dirname, "commands");
export const commandFiles = (await fs.readdir(commandsPath))
  .filter((file) => path.extname(file) == ".js")
  .map((file) => path.join(commandsPath, file));
export const commands = new Collection(
  (
    await Promise.all(
      commandFiles.map(async (file) => {
        const commandGroup = (await import(file)).default;
        return commandGroup.map((c) => [c.data.name, c]);
      })
    )
  ).flat()
);
