import type { Pillar } from "@/lib/types";

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
}

// Links are to each provider's search page for the topic, so they never go stale.
const q = (base: string, term: string) => `${base}${encodeURIComponent(term)}`;
const COURSERA = "https://www.coursera.org/search?query=";
const UDEMY = "https://www.udemy.com/courses/search/?q=";
const NPTEL = "https://nptel.ac.in/courses";

export const CERTIFICATIONS: Certification[] = [
  { title: "Programming for Everybody: Python", description: "Learn Python basics through short exercises and hands-on examples.", provider: "Coursera", url: q(COURSERA, "python for everybody"), skills: ["skills", "placement"], departments: [], tag: "Python" },
  { title: "Data Structures and Algorithms", description: "Practise core data structures, algorithms, and problem solving.", provider: "Coursera", url: q(COURSERA, "data structures and algorithms"), skills: ["placement", "skills"], departments: ["Comp", "IT", "AI&DS"], tag: "Coding" },
  { title: "Complete Aptitude and Reasoning", description: "Build speed in quantitative aptitude, logic, and placement tests.", provider: "Udemy", url: q(UDEMY, "aptitude reasoning placement"), skills: ["placement"], departments: [], tag: "Aptitude" },
  { title: "Machine Learning Specialization", description: "Learn machine learning foundations, model evaluation, and applications.", provider: "Coursera", url: q(COURSERA, "machine learning specialization"), skills: ["skills"], departments: ["Comp", "IT", "AI&DS"], tag: "AI / ML" },
  { title: "SQL for Data Analysis", description: "Query datasets and turn results into clear analysis.", provider: "Udemy", url: q(UDEMY, "sql data analysis"), skills: ["skills", "placement"], departments: ["Comp", "IT", "AI&DS"], tag: "Databases" },
  { title: "Web Development Bootcamp", description: "Build responsive websites with practical web development tools.", provider: "Udemy", url: q(UDEMY, "web development bootcamp"), skills: ["skills"], departments: ["Comp", "IT"], tag: "Web" },
  { title: "Digital Electronics", description: "Study logic design, circuits, and digital systems.", provider: "NPTEL", url: NPTEL, skills: ["academic", "skills"], departments: ["ENTC"], tag: "Core subject" },
  { title: "Embedded Systems Design", description: "Explore microcontrollers, embedded software, and system design.", provider: "NPTEL", url: NPTEL, skills: ["skills"], departments: ["ENTC"], tag: "Embedded" },
  { title: "Communication Skills for Interviews", description: "Practise clear, structured answers for interview conversations.", provider: "Coursera", url: q(COURSERA, "communication skills interview"), skills: ["placement", "feedback"], departments: [], tag: "Soft skills" },
  { title: "Resume and LinkedIn Profile Building", description: "Present your projects, experience, and skills to recruiters.", provider: "Udemy", url: q(UDEMY, "resume linkedin profile"), skills: ["placement", "engagement"], departments: [], tag: "Career" },
  { title: "Effective Time and Study Management", description: "Use practical strategies for focused learning and recall.", provider: "Coursera", url: q(COURSERA, "learning how to learn"), skills: ["academic", "attendance", "lms"], departments: [], tag: "Study skills" },
  { title: "Engineering Mathematics", description: "Review core engineering mathematics with guided lessons.", provider: "NPTEL", url: NPTEL, skills: ["academic"], departments: [], tag: "Core subject" },
  { title: "Teamwork and Leadership", description: "Develop collaboration, communication, and leadership skills.", provider: "Coursera", url: q(COURSERA, "teamwork leadership"), skills: ["engagement", "feedback"], departments: [], tag: "Soft skills" },
  { title: "Cloud Fundamentals (AWS or Azure)", description: "Understand cloud concepts, architecture, and core services.", provider: "Coursera", url: q(COURSERA, "cloud computing fundamentals"), skills: ["skills", "placement"], departments: ["Comp", "IT", "AI&DS"], tag: "Cloud" },
];
