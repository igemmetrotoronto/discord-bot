import { Configuration as OpenAIConfiguration, OpenAIApi } from "openai";
import config from "./config.json" assert { type: "json" };
import { createReadStream } from "fs";
import { readdir } from "fs/promises";
import _ from "lodash";

export const openaiConfiguration = new OpenAIConfiguration({
  apiKey: config.openAI,
});
export const openai = new OpenAIApi(openaiConfiguration);

console.log(
  (
    await Promise.allSettled(
      _.take(
        await readdir("./recordings/5f9c6c17-5fbb-4a6b-95b9-f776a163f51c"),
        1000
      ).map((v) =>
        openai.createTranscription(
          createReadStream(
            "./recordings/5f9c6c17-5fbb-4a6b-95b9-f776a163f51c/" + v
          ),
          "whisper-1",
          undefined,
          "verbose_json",
          undefined,
          "en"
        )
      )
    )
  ).map((r) => r.value?.data?.text)
);

// try {
//   console.log(
//     (
//       await Promise.all([
//         _.first(
//           await readdir("./recordings/5f9c6c17-5fbb-4a6b-95b9-f776a163f51c"),
//           2
//         ).map((p) =>
//           openai.createTranscription(
//             createReadStream(p),
//             "whisper-1",
//             undefined,
//             "verbose_json",
//             undefined,
//             "en"
//           )
//         ),
//       ])
//     ).length
//   );
// } catch (error) {
//   console.log(error);
// }

// console.log(
//   (
//     await openai.createTranscription(
//       await createReadStream(
//         "./recordings/5f9c6c17-5fbb-4a6b-95b9-f776a163f51c/1679702232649-744368561132273675.wav"
//       ),
//       "whisper-1",
//       undefined,
//       "verbose_json",
//       undefined,
//       "en"
//     )
//   ).data
// );
