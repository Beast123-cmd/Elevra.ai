/** Curated, static list of recurring hackathons and contests (no live scraping, by design).
 *  Dates change every year, so cards link to the official site instead of showing dates.
 *  Links were checked on 11 Oct 2026. */
export type HackathonKind = "National" | "Global" | "Platform" | "Coding contest";

export interface Hackathon {
  name: string;
  organiser: string;
  kind: HackathonKind;
  format: "Team" | "Solo" | "Team or solo";
  departments: string[]; // empty = suits every department
  focus: string[];
  about: string;
  url: string;
}

export const HACKATHONS: Hackathon[] = [
  {
    name: "Smart India Hackathon", organiser: "Ministry of Education, Government of India", kind: "National", format: "Team",
    departments: [], focus: ["Real problem statements", "Software & hardware"],
    about: "India's largest student hackathon: teams solve problem statements set by ministries and industry, with an internal college round first.",
    url: "https://sih.gov.in/",
  },
  {
    name: "Devfolio hackathons", organiser: "Devfolio", kind: "Platform", format: "Team",
    departments: ["Comp", "IT", "AI&DS"], focus: ["Web & app", "Student-run events"],
    about: "Where most Indian college and IIT/NIT student hackathons are listed. Good for finding an event near you or online.",
    url: "https://devfolio.co/hackathons",
  },
  {
    name: "Unstop hackathons", organiser: "Unstop", kind: "Platform", format: "Team or solo",
    departments: [], focus: ["Corporate challenges", "Case & tech"],
    about: "Lists company-run hackathons and challenges that often lead to interviews or internships.",
    url: "https://unstop.com/hackathons",
  },
  {
    name: "MLH hackathons", organiser: "Major League Hacking", kind: "Global", format: "Team",
    departments: ["Comp", "IT", "AI&DS"], focus: ["Beginner friendly", "Online & in person"],
    about: "A global league of student hackathons, many of them online and beginner friendly. A good first hackathon.",
    url: "https://www.mlh.com/",
  },
  {
    name: "HackerEarth hackathons", organiser: "HackerEarth", kind: "Platform", format: "Team or solo",
    departments: ["Comp", "IT", "AI&DS"], focus: ["Corporate", "Online"],
    about: "Online hackathons run with companies, often themed around their products or hiring.",
    url: "https://www.hackerearth.com/challenges/hackathon/",
  },
  {
    name: "TCS CodeVita", organiser: "Tata Consultancy Services", kind: "Coding contest", format: "Solo",
    departments: [], focus: ["Competitive programming", "Hiring"],
    about: "A large global coding contest from TCS. A strong result is noticed in campus hiring.",
    url: "https://codevita.tcsapps.com/",
  },
  {
    name: "Microsoft Imagine Cup", organiser: "Microsoft", kind: "Global", format: "Team",
    departments: ["Comp", "IT", "AI&DS"], focus: ["Startup ideas", "AI & cloud"],
    about: "A global student competition for building a product or startup idea with Microsoft technology.",
    url: "https://imaginecup.microsoft.com/en-us",
  },
  {
    name: "ETHIndia", organiser: "Devfolio", kind: "National", format: "Team",
    departments: ["Comp", "IT"], focus: ["Web3", "Blockchain"],
    about: "One of the biggest Ethereum and web3 hackathons in Asia, held in India.",
    url: "https://ethindia.co/",
  },
  {
    name: "Kaggle competitions", organiser: "Kaggle (Google)", kind: "Global", format: "Team or solo",
    departments: ["AI&DS", "Comp"], focus: ["Machine learning", "Data science"],
    about: "Machine learning and data science competitions on real datasets, with public leaderboards you can show recruiters.",
    url: "https://www.kaggle.com/competitions",
  },
  {
    name: "NASA Space Apps Challenge", organiser: "NASA", kind: "Global", format: "Team",
    departments: [], focus: ["Open data", "Science & engineering"],
    about: "A worldwide hackathon on NASA's open data, held in cities across India and online. Suits every branch.",
    url: "https://www.spaceappschallenge.org/",
  },
  {
    name: "e-Yantra Robotics Competition", organiser: "IIT Bombay", kind: "National", format: "Team",
    departments: ["ENTC", "Comp"], focus: ["Robotics", "Embedded systems"],
    about: "A national robotics and embedded systems competition with guided, staged tasks. Strong for ENTC students.",
    url: "https://e-yantra.org/",
  },
  {
    name: "CodeChef contests", organiser: "CodeChef", kind: "Coding contest", format: "Solo",
    departments: [], focus: ["Competitive programming", "Weekly practice"],
    about: "Regular online coding contests. A steady way to build the coding score that placement tests check.",
    url: "https://www.codechef.com/contests",
  },
  {
    name: "Hack This Fall", organiser: "Hack This Fall", kind: "National", format: "Team",
    departments: ["Comp", "IT", "AI&DS"], focus: ["Beginner friendly", "Student-run"],
    about: "A student-run hackathon community in India known for welcoming first-time hackers.",
    url: "https://hackthisfall.tech/",
  },
];
