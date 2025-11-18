import { EventConfig } from "motia";

// Step - 4 :
// Generates AI based titles for the fetched videos
export const config = {
  name: "generateTitles",
  type: "event",
  subscribes: ["yt.videos.fetched"],
  emits: ["yt.titles.ready", "yt.titles.error"],
};

interface Video {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
}

interface ImprovedTitle {
  original: string;
  improved: string;
  rational: string;
  url: string;
}

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;
  let email: string | undefined;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;

    const channelName = data.channelName;
    const videos = data.videos;

    logger.info("Resolving youtube channel", {
      jobId,
      videoCount: videos.length,
    });

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      throw new Error("Openai Api key is not configured");
    }

    const jobData = await state.get(`job: ${jobId}`);
    await state.set(`job: ${jobId}`, {
      ...jobData,
      status: "generating titles",
    });

    const videoTitles = videos
      .map((v: Video, idx: number) => `${idx + 1}. ${v.title}`)
      .join("\n");

    const prompt = `You are a YouTube title optimization expert. Below are ${videos.length} video titles from the channel "${channelName}".

For each title, provide:
1. An improved version that is more engaging, SEO-friendly, and likely to get more clicks
2. A brief rationale (1–2 sentences) explaining why the improved title is better

Guidelines:
- Keep the core topic and authenticity
- Use action verbs, numbers, and specific value propositions
- Make it curiosity-inducing without being clickbait
- Optimize for searchability and clarity

Video Titles:
${videoTitles}

Respond in JSON format:
{
  "titles": [
    {
      "original": "...",
      "improved": "...",
      "rationale": "..."
    }
  ]
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "you are a yputube SEO and engagement expert who helps creators write better video titles",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenAI API error: ${errorData.error?.message} || unknown AI error`
      );
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices[0].message.content;

    const parsedResponse = JSON.parse(aiContent);

    const improvedTitles: ImprovedTitle[] = parsedResponse.titles.map(
      (t: any, idx: number) => ({
        original: t.original,
        improved: t.improved,
        rational: t.rationale,
        url: videos[idx].url,
      })
    );

    logger.info("Titles generated Successfully", {
      jobId,
      count: improvedTitles.length,
    });

    await state.get(`job: ${jobId}`, {
      ...jobData,
      status: "titles generated",
      improvedTitles,
    });

    await emit({
      topic: "yt.titles.ready",
      data: {
        jobId,
        channelName,
        improvedTitles,
        email,
      },
    });
  } catch (error: any) {
    logger.error("Error generating titles", { error: error?.message });

    if (jobId || email) {
      logger.error(
        "cannot send error notification as jobId or email is missing"
      );
    }
    const jobData = await state.get(`job: ${jobId}`);

    await state.get(`job: ${jobId}`, {
      ...jobData,
      status: "failed",
      error: error.message,
    });

    await emit({
      topic: "yt.titles.error",
      data: {
        jobId,
        email,
        error: "Failed to fetch improved titles",
      },
    });
  }
};
