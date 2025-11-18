import { EventConfig } from "motia";
import { Resend } from "resend";

// Step - 5 :
// Sends an email with the improved titles to the user
export const config = {
  name: "SendEmail",
  type: "event",
  subscribes: ["yt.titles.ready"],
  emits: ["yt.email.send"],
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
   
    try {
        const data = eventData || {};
        jobId = data.jobId;
        const email = data.email;
        const channelName = data.channelName;
        const improvedTitles: ImprovedTitle[] = data.improvedTitles;

        logger.info("Sending email with improved titles", {
          jobId,
          titleCount: improvedTitles.length,
          email,
        });
       
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
        if (!RESEND_API_KEY) {
          throw new Error("Resend Api key is not configured");
        }

        const jobData = await state.get(`job: ${jobId}`);
        await state.set(`job: ${jobId}`, {
          ...jobData,
          status: "sending email",
        });

        const emailText = generateEmailText(channelName, improvedTitles);

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to: [email],
            subject: `Your Improved YouTube Titles for ${channelName}`,
            text: emailText,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Resend API error: ${errorData.error?.message} || 'Unknown Email error'`);
        }
      
        const emailResult = await response.json();

        logger.info("Email sent successfully", { jobId, email ,
emailId: emailResult.id});

        await state.set(`job: ${jobId}`, {
          ...jobData,
          status: "Completed",
          emailId: emailResult.id,
          completedAt: new Date().toISOString(),
        });

        await emit({
          topic: "yt.email.send",
          data: {
            jobId,
           email,
            emailId: emailResult.id,
          },
        });
      

    } catch (error : any) { {

        logger.error("Error sending email", { jobId, error });

        if (!jobId) {
            logger.error("Job ID is missing, cannot update job status");
            return;
        }

        const jobData = await state.get(`job: ${jobId}`);
        
        await state.set(`job: ${jobId}`, {
            ...jobData,
            status: "failed",
            error: error.message,
        });

      
        
    }

}}

function generateEmailText(
    channelName: string,
    titles: ImprovedTitle[]
): string {
    let text = `youtube Title Doctor - Improved Titles for Channel: ${channelName}\n`;
    text+= `${'='.repeat(50)}\n\n`;

    titles.forEach((title, index) => {
        text += ` Video ${index + 1}:\n`;
        text += `------------------------------\n`;
        text += `Original Title: ${title.original}\n`;
        text += `Improved Title: ${title.improved}\n`;
        text += `Why: ${title.rational}\n`;

    });
        text += `${"=".repeat(60)}\n`;
        text += 'Powered by Motia.dev\n';
     
        return text;
}

