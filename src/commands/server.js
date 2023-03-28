import { SlashCommandBuilder } from "discord.js";

export default [
  {
    data: new SlashCommandBuilder()
      .setName("server")
      .setDescription("Provides information about the server."),
    /**
     * @param {import("discord.js").Interaction} interaction
     */
    async execute(interaction) {
      await interaction.reply(
        `This server is ${interaction.guild.name} and has ${interaction.guild.memberCount} members.`
      );
    },
  },
];
