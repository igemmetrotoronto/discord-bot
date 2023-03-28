import { SlashCommandBuilder } from "discord.js";

export default [
  {
    data: new SlashCommandBuilder()
      .setName("user")
      .setDescription("Provides information about the user."),
    /**
     * @param {import("discord.js").Interaction} interaction
     */
    async execute(interaction) {
      await interaction.reply(
        `This command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}.`
      );
    },
  },
];
