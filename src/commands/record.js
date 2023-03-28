import {
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
} from "@discordjs/voice";
import Opus from "@discordjs/opus";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  SlashCommandBuilder,
} from "discord.js";
import { Transform } from "stream";
import { FileWriter } from "wav";
import path from "path";
import fs from "fs/promises";
import { v4 as uuid } from "uuid";
import { __dirname } from "../utils.js";
import { promisify } from "util";
import childProcess from "child_process";
import _ from "lodash";
const exec = promisify(childProcess.exec);

let recordingSession = { recording: false };

export default [
  {
    data: new SlashCommandBuilder()
      .setName("startmeeting")
      .setDescription("Starts a meeting in the specified voice channel.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to start the meeting in.")
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      ),
    /**
     * @param {import("discord.js").Interaction} interaction
     */
    async execute(interaction) {
      const channel = interaction.options.getChannel("channel");

      await interaction.reply(`Started recording meeting in <#${channel.id}>`);

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        selfDeaf: false,
        selfMute: true,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      const { receiver } = connection;

      const recordingSessionId = uuid();
      const recordingsPath = path.join(
        __dirname,
        "..",
        "recordings",
        recordingSessionId
      );
      await fs.mkdir(recordingsPath, { recursive: true });
      const currentlyRecording = new Set();
      const recordings = [];

      recordingSession = {
        startTime: Date.now(),
        recordings,
        recordingsPath,
        connection,
        recording: true,
        id: recordingSessionId,
      };

      receiver.speaking.on("start", (userId) => {
        if (currentlyRecording.has(userId)) return;
        currentlyRecording.add(userId);

        const startTime = Date.now();
        const filename = path.join(
          recordingsPath,
          `${startTime}-${userId}.wav`
        );
        const encoder = new Opus.OpusEncoder(16000, 1);
        const audioStream = receiver
          .subscribe(userId, {
            end: { behavior: EndBehaviorType.AfterSilence, duration: 500 },
          })
          .pipe(new OpusDecodingStream({}, encoder))
          .pipe(
            new FileWriter(filename, {
              channels: 1,
              sampleRate: 16000,
            })
          );

        audioStream.on("finish", async () => {
          currentlyRecording.delete(userId);
          recordings.push({
            filename,
            userId,
            startTime,
          });
        });
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("stopmeeting")
      .setDescription("Stops the current meeting."),
    /**
     * @param {import("discord.js").Interaction} interaction
     */
    async execute(interaction) {
      if (!recordingSession.recording)
        return await interaction.reply("There is no meeting right now.");

      const thread = await (
        await (
          await interaction.reply("Here is the transcript from this meeting:")
        ).fetch()
      ).startThread({
        name: `Meeting transcript from ${new Date(
          recordingSession.startTime
        ).toDateString()}`,
      });

      thread.sendTyping();
      const typingInterval = setInterval(() => thread.sendTyping(), 5_000);

      recordingSession.recording = false;
      recordingSession.connection.destroy();

      const parsedRecordings = [];
      for (const r of recordingSession.recordings) {
        parsedRecordings.push({
          duration:
            +(
              await exec(
                `ffprobe -i ${r.filename} -show_entries format=duration -v quiet -of csv="p=0"`
              )
            ).stdout.trim() * 1000,
          start: r.startTime - recordingSession.startTime,
          filename: r.filename,
          userId: r.userId,
          transcript: JSON.parse(
            (
              await exec(
                `python ${path.join(__dirname, "..", "transcribe.py")} ${
                  r.filename
                }`
              )
            ).stdout
          ),
        });
      }

      const fullTranscript = _.sortBy(
        parsedRecordings
          .map((r) =>
            r.transcript.map((t) => ({
              text: t.text,
              start: r.start + t.start,
              userId: r.userId,
            }))
          )
          .flat(),
        "start"
      );

      // Messages transcript
      {
        const textTranscriptSegments = fullTranscript.map(
          (t) => `[<@${t.userId}>] ${t.text}`
        );
        const transcriptMessages = [""];

        for (const transcriptSegment of textTranscriptSegments) {
          if (
            (
              transcriptMessages[transcriptMessages.length - 1] +
              transcriptSegment +
              "\n\n"
            ).length < 2000
          )
            transcriptMessages[transcriptMessages.length - 1] +=
              transcriptSegment + "\n\n";
          else {
            transcriptMessages.push(transcriptSegment + "\n\n");
          }
        }

        clearInterval(typingInterval);
        for (const transcriptMessage of transcriptMessages)
          thread.send(transcriptMessage.trim());
      }

      // File transcript
      {
        const userIdToName = async (userId) =>
          (await interaction.guild.members.fetch()).find(
            (m) => m.user.id === userId
          ).displayName;

        const textTranscript = (
          await Promise.all(
            fullTranscript.map(
              async (t) => `[${await userIdToName(t.userId)}] ${t.text}`
            )
          )
        )
          .join("\n\n")
          .trim();

        const transcriptPath = path.join(
          __dirname,
          "..",
          "transcripts",
          `${recordingSession.id}`
        );
        await fs.writeFile(transcriptPath + ".txt", textTranscript);
        await fs.writeFile(
          transcriptPath + ".json",
          JSON.stringify({ startTime: recordingSession.startTime })
        );

        await thread.send({
          files: [transcriptPath + ".txt"],
        });
      }

      // Conversation button
      {
        await thread.send({
          content: "Any questions?",
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`transcript-conversation:${recordingSession.id}`)
                .setLabel("I'm here to help!")
                .setStyle(ButtonStyle.Primary)
            ),
          ],
        });
      }

      await fs.rm(recordingSession.recordingsPath, { recursive: true });
    },
  },
];

class OpusDecodingStream extends Transform {
  constructor(options, encoder) {
    super(options);
    this.encoder = encoder;
  }

  _transform(data, encoding, callback) {
    this.push(this.encoder.decode(data));
    callback();
  }
}
