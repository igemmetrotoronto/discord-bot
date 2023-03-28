import { pingCommand } from "./ping.js";

export const commands = [pingCommand];
export const commandsMap = new Map(commands.map((c) => [c.data.name, c]));
