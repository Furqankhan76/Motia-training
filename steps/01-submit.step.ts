import { ApiRouteConfig } from "motia";
//Step - 1 :
// Accept channel name and email to start the work
export const config: ApiRouteConfig = {
  name: "SubmitChannel",
  type: "api",
  path: "/submit",
  method: "POST",
  emits: ["yt.submit"],
};

interface SubmitRequest {
  channel: string;
  email: string;
}

export const handler = async (req: any, { emit, logger, state }: any) => {
  try {
    logger.info("Recieved submission request", { body: req.body });
    const { channel, email } = req.body as SubmitRequest;
    if (!channel || !email) {
      return {
        body: {
          status: 400,
          body: {
            error: "Missing channel or email",
          },
        },
      };
    }
    //validate
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        status: 400,
        body: {
          error: "Invalid email format",
        },
      };
    }
    const jobId = `job_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    await state.set(`jobId: ${jobId}`, {
      jobId,
      channel,
      email,
      status: "queued",
      createdAt: new Date().toISOString(),
    });
    logger.info("Job created", { jobId, channel, email });
    await emit({
      topic: "yt.submit",
      data: {
        jobId,
        channel,
        email,
      },
    });
    return {
      status: 202,
      body: {
        success: true,
        jobId,
        message:
          "your request has been queued. you will receive an email once processing is complete.",
      },
    };
  } catch (error: any) {
    logger.error("Error in submission handler", { error: error.message });

    return {
      status: 500,
      body: {
        status: 500,
        body: {
          error: "Internal Server Error",
        },
      },
    };
  }
};
