import type { Pillar } from "@/lib/types";
import coursesJson from "./courses.json";

export const PILLAR_LABEL: Record<Pillar, string> = {
  academic: "Academics", attendance: "Attendance", lms: "Online learning (LMS)", placement: "Placement readiness",
  skills: "Skills", engagement: "Co-curricular", feedback: "Feedback",
};

// Static, curated steps for each score area. Shown for a student's two weakest areas.
export const PLAYBOOK: Record<Pillar, { why: string; steps: string[] }> = {
  academic: {
    why: "Marks and backlogs carry the most weight in your score.",
    steps: [
      "Ask your mentor for a week-by-week revision plan for your weakest subject",
      "Attend subject-faculty doubt sessions and bring two specific questions each time",
      "If you have a backlog, register for the supplementary exam and block study time for it first",
    ],
  },
  attendance: {
    why: "Regular attendance helps you keep up with classes and spot missed topics early.",
    steps: [
      "Check your subject-wise attendance and find the subject you are lowest in",
      "Treat the next 4 weeks as a reset: attend every lecture of that subject",
      "Talk to your mentor early if something outside college is getting in the way",
    ],
  },
  lms: {
    why: "Steady online activity and on-time submissions are the earliest sign of a good semester.",
    steps: [
      "Log in on a fixed schedule, for example 20 minutes after your last lecture",
      "Submit pending assignments oldest first, even if they are only partly done",
      "Turn on LMS reminders so deadlines don't catch you off guard",
    ],
  },
  placement: {
    why: "Coding, aptitude and interview practice decide how many campus drives you can clear.",
    steps: [
      "Solve two coding problems a day for 30 days, starting from easy",
      "Take a timed aptitude practice test every weekend and review the mistakes",
      "Take two mock interviews in this app and work on the gaps they point out",
    ],
  },
  skills: {
    why: "Verified skills and certifications show employers what you can do.",
    steps: [
      "Pick one technical skill linked to your target role and learn it for 4 weeks",
      "Complete one certification from the list on the Certifications page",
      "Build one small project with it and keep it on GitHub",
    ],
  },
  engagement: {
    why: "Clubs, events and hackathons build the soft skills and proof of initiative recruiters look for.",
    steps: [
      "Join one club that matches your interests this month",
      "Register for the next campus event and take part in it",
      "Enter one hackathon, even in a team, to get a first verified entry",
    ],
  },
  feedback: {
    why: "Your feedback scores show how supported you feel in your classes.",
    steps: [
      "Share what is and isn't working for you in the next feedback survey",
      "Talk to your mentor about any subject where you feel lost",
      "Note down one thing you want from your faculty this semester and ask for it",
    ],
  },
};

export interface Certification {
  title: string;
  description: string;
  provider: "Coursera" | "Udemy" | "NPTEL";
  url: string;
  skills: Pillar[];
  departments: string[]; // empty = all departments
  tag: string;
  trains?: string[];     // fine-grained skills the course builds (names as in the skills table, e.g. "DSA", "Public speaking")
  level?: "Beginner" | "Intermediate" | "Advanced";
  keywords?: string[];   // extra words people search by (e.g. "ai", "ml", "dsa"); used by search and by the Ask Elevra assistant
}

// The catalog lives in courses.json so the Certifications page and the Ask Elevra assistant (backend/routers/assistant.py)
// read the same list. Links go to each provider's search page for the course, so they never go stale.
export const CERTIFICATIONS = coursesJson as Certification[];
