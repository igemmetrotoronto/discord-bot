import path from "path";
import url from "url";
import { Configuration as OpenAIConfiguration, OpenAIApi } from "openai";
import config from "../config.json" assert { type: "json" };

/**
 * @param {import("discord.js").Interaction} interaction
 * @param {import("discord.js").MessagePayload} message
 */
export async function replyOrFollowUp(interaction, message) {
  if (interaction.relied || interaction.deferred)
    await interaction.followUp(message);
  else interaction.reply(message);
}

export const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export const openaiConfiguration = new OpenAIConfiguration({
  apiKey: config.openAI,
});
export const openai = new OpenAIApi(openaiConfiguration);

export const generateChatGPTResponse = async (messages) =>
  (
    await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages,
    })
  ).data.choices[0].message.content.trim();
export async function generateChatGPTContext(guild) {
  const allMembers = Array.from((await guild.members.fetch()).values()).filter(
    (member) => !member.user.bot
  );
  const listFormatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  });
  const context =
    `Use Markdown to style your answers.\n\nHere is some context to help you:\nYour name is "iGEM Metro Toronto Bot". This is the Discord server of a new iGEM team you are here to help.\nHere are all the people on the team:\n` +
    allMembers
      .map(
        (member) =>
          `\t1. ${member.displayName} is in the teams: ${listFormatter.format(
            member.roles.cache
              .map((r) => r.name)
              .filter((r) => r !== "@everyone")
          )}. You can mention him using <@${member.user.id}>.`
      )
      .join("\n") +
    `\nOverall, there are ${allMembers.length} team members on the server.\n\nYou must always do your best to mention a user when you are referring to them.`;
  return context;
}
