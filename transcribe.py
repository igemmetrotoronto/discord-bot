import json

import whisper
import sys

model = whisper.load_model("large")
result = model.transcribe(sys.argv[1])
print(
    json.dumps(
        [
            {"text": segment["text"].strip(), "start": segment["start"] * 1000}
            for segment in result["segments"]
        ]
    )
)
