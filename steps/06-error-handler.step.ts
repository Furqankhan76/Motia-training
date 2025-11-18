import { EventConfig } from "motia";

// Step - 6 :

export const config = {
  name: "errorHandler",
  type: "event",
  subscribes: ["yt.channel.error", "yt.videos.error", "yt.titles.error"],
  emits: ["yt.error.notified"],
};

export const handler = async (eventData: any, { emit, logger, state }: any) => {

    const data = eventData || {};
   const jobId = data.jobId;
   const email = data.email;
   const error = data.error || "Unknown error occurred";

   logger.info("Handling error Notification", { jobId, error });

   const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
    if (!RESEND_API_KEY) {
      throw new Error("Resend Api key is not configured");
    }

    const emailText = `We are facing some issue while processing your request.`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: email,
        subject: 'Request Failed for Youtube Title Doctor',
        text: emailText,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
      throw new Error(`Resend API error: ${errorData.message || 'Unknown email error'}`);
    }
    const emailResponse = await response.json();

    await emit({
      name: "yt.error.notified",
      data: {
        jobId,
        email,
        emailId : emailResponse.id
      },
    });

    try {
        
    } catch ( error: any) {

        logger.error("Failed to send error notification email", {error  });
        
    }
}