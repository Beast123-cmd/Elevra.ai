export interface AchievementActivity {
  type: "event" | "club" | "hackathon" | "certification";
  name: string;
  date: string | null;
}

export interface AchievementInterview {
  score: number;
  created_at: string;
}

export interface StudentAchievements {
  activities: AchievementActivity[];
  interviews: AchievementInterview[];
  xp: number;
  title: string;
  nextTitle: string | null;
  xpToNext: number;
  titleProgress: number;
  loginStreak: number;
  challengeCount: number;
}

export function buildAchievements(activities: AchievementActivity[], interviews: AchievementInterview[], dailyPoints = 0, loginStreak = 0, challengeCount = 0): StudentAchievements {
  const counts = activities.reduce((result, item) => {
    result[item.type] += 1;
    return result;
  }, { event: 0, club: 0, hackathon: 0, certification: 0 });
  const xp = counts.hackathon * 100 + counts.certification * 80 + (counts.event + counts.club) * 25
    + interviews.length * 30 + interviews.filter((item) => item.score >= 4.5).length * 20 + dailyPoints;
  const titles = [
    { name: "Campus Newcomer", xp: 0 },
    { name: "Opportunity Scout", xp: 100 },
    { name: "Skill Builder", xp: 300 },
    { name: "Campus Champion", xp: 600 },
  ];
  const current = [...titles].reverse().find((item) => xp >= item.xp) ?? titles[0];
  const next = titles[titles.indexOf(current) + 1] ?? null;
  return {
    activities, interviews, xp, title: current.name, nextTitle: next?.name ?? null, loginStreak, challengeCount,
    xpToNext: next ? next.xp - xp : 0,
    titleProgress: next ? Math.max(0, Math.min(100, ((xp - current.xp) / (next.xp - current.xp)) * 100)) : 100,
  };
}

export interface BadgeProgress {
  name: string;
  description: string;
  progress: number;
  target: number;
  icon: "trophy" | "certificate" | "interview" | "sparkles" | "streak";
}

export function getBadges(data: StudentAchievements): BadgeProgress[] {
  const hackathons = data.activities.filter((item) => item.type === "hackathon").length;
  const certifications = data.activities.filter((item) => item.type === "certification").length;
  const strongInterviews = data.interviews.filter((item) => item.score >= 4.5).length;
  const recent = [...data.interviews].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const average = recent.length ? recent.reduce((sum, item) => sum + item.score, 0) / recent.length : 0;
  return [
    { name: "Hackathon Rookie", description: "Join your first verified hackathon.", progress: hackathons, target: 1, icon: "trophy" },
    { name: "Hackathon Regular", description: "Take part in three verified hackathons.", progress: hackathons, target: 3, icon: "trophy" },
    { name: "Certified", description: "Complete your first verified certification.", progress: certifications, target: 1, icon: "certificate" },
    { name: "Lifelong Learner", description: "Complete three verified certifications.", progress: certifications, target: 3, icon: "certificate" },
    { name: "Interview Standout", description: "Score 4.5 or higher in a mock interview.", progress: strongInterviews, target: 1, icon: "interview" },
    { name: "Interview Ready", description: "Average 4.0 across your latest three interviews.", progress: recent.length >= 3 && average >= 4 ? 1 : 0, target: 1, icon: "interview" },
    { name: "All-Rounder", description: "Earn a verified hackathon, certification, and interview score.", progress: hackathons > 0 && certifications > 0 && data.interviews.length > 0 ? 1 : 0, target: 1, icon: "sparkles" },
    { name: "Streak Keeper", description: "Log in seven days in a row.", progress: data.loginStreak, target: 7, icon: "streak" },
    { name: "Daily Starter", description: "Complete your first daily aptitude or coding challenge.", progress: data.challengeCount, target: 1, icon: "streak" },
  ];
}
