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
  loginDays: number;
  testCount: number;
  challengeCount: number;
}

function safeCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

export function buildAchievements(activities: AchievementActivity[], interviews: AchievementInterview[], dailyPoints = 0, loginStreak = 0, challengeCount = 0, loginDays = 0, testCount = 0): StudentAchievements {
  const counts = activities.reduce((result, item) => {
    result[item.type] += 1;
    return result;
  }, { event: 0, club: 0, hackathon: 0, certification: 0 });
  const earnedPoints = safeCount(dailyPoints);
  const safeLoginStreak = safeCount(loginStreak);
  const safeLoginDays = safeCount(loginDays);
  const safeTestCount = safeCount(testCount);
  const safeChallengeCount = safeCount(challengeCount);
  const xp = counts.hackathon * 100 + counts.certification * 80 + (counts.event + counts.club) * 25
    + interviews.length * 30 + interviews.filter((item) => item.score >= 4.5).length * 20 + earnedPoints;
  const titles = [
    { name: "Campus Newcomer", xp: 0 },
    { name: "Opportunity Scout", xp: 1000 },
    { name: "Skill Builder", xp: 3000 },
    { name: "Rising Professional", xp: 7500 },
    { name: "Campus Leader", xp: 15000 },
    { name: "Elevra Legend", xp: 30000 },
  ];
  const current = [...titles].reverse().find((item) => xp >= item.xp) ?? titles[0];
  const next = titles[titles.indexOf(current) + 1] ?? null;
  return {
    activities, interviews, xp, title: current.name, nextTitle: next?.name ?? null,
    loginStreak: safeLoginStreak, loginDays: safeLoginDays, testCount: safeTestCount, challengeCount: safeChallengeCount,
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
  const campusActivities = data.activities.filter((item) => item.type === "event" || item.type === "club").length;
  const sortedInterviews = [...data.interviews].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const recent = sortedInterviews.slice(0, 10);
  const average = recent.length ? recent.reduce((sum, item) => sum + item.score, 0) / recent.length : 0;
  let strongRun = 0;
  for (const item of sortedInterviews.slice(0, 10)) {
    if (item.score < 4.5) break;
    strongRun += 1;
  }
  const allRounderProgress = Math.min(hackathons / 5, certifications / 10, data.interviews.length / 10) * 10;
  return [
    { name: "Hackathon Regular", description: "Take part in five verified hackathons.", progress: hackathons, target: 5, icon: "trophy" },
    { name: "Hackathon Veteran", description: "Complete 25 verified hackathons over your campus journey.", progress: hackathons, target: 25, icon: "trophy" },
    { name: "Certified Specialist", description: "Complete five verified certifications.", progress: certifications, target: 5, icon: "certificate" },
    { name: "Lifelong Learner", description: "Complete 20 verified certifications.", progress: certifications, target: 20, icon: "certificate" },
    { name: "Interview Standout", description: "Earn a 4.5+ score in ten mock interviews in a row.", progress: strongRun, target: 10, icon: "interview" },
    { name: "Interview Veteran", description: "Complete 50 scored mock interviews.", progress: data.interviews.length, target: 50, icon: "interview" },
    { name: "Consistent Communicator", description: "Average 4.5+ across your latest ten mock interviews.", progress: recent.length >= 10 && average >= 4.5 ? 1 : 0, target: 1, icon: "interview" },
    { name: "All-Rounder", description: "Complete five hackathons, 10 certifications, and 10 mock interviews.", progress: allRounderProgress, target: 10, icon: "sparkles" },
    { name: "Streak Builder", description: "Keep a 30-day login streak.", progress: data.loginStreak, target: 30, icon: "streak" },
    { name: "Quarter-Year Chain", description: "Keep a 90-day login streak.", progress: data.loginStreak, target: 90, icon: "streak" },
    { name: "Year of Momentum", description: "Log in for 365 consecutive days.", progress: data.loginStreak, target: 365, icon: "streak" },
    { name: "Steady Presence", description: "Show up on 100 different days.", progress: data.loginDays, target: 100, icon: "streak" },
    { name: "Year-Round Learner", description: "Show up on 365 different days.", progress: data.loginDays, target: 365, icon: "streak" },
    { name: "Test Finisher", description: "Complete 25 timed tests.", progress: data.testCount, target: 25, icon: "trophy" },
    { name: "Assessment Veteran", description: "Complete 100 timed tests.", progress: data.testCount, target: 100, icon: "trophy" },
    { name: "Problem Solver", description: "Answer 500 timed test questions.", progress: data.challengeCount, target: 500, icon: "sparkles" },
    { name: "Problem Marathoner", description: "Answer 2,500 timed test questions.", progress: data.challengeCount, target: 2500, icon: "sparkles" },
    { name: "Campus Contributor", description: "Join 25 verified campus events or clubs.", progress: campusActivities, target: 25, icon: "certificate" },
  ];
}
