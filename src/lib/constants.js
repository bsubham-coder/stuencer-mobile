export const STUDENTS = [
  { id: "subham_kumar", name: "Subham Kumar", role: "student" },
  { id: "aditya_singh", name: "Aditya Singh", role: "student" },
  { id: "amarajeet_kumar", name: "Amarajeet Kumar", role: "student" },
  { id: "puneet_kumar", name: "Puneet Kumar", role: "student" },
  { id: "abhijeet_singh", name: "Abhijeet Singh", role: "student" },
];

export const PROFESSORS = [
  { id: "karali_patra", name: "Prof. Karali Patra", role: "professor" },
];

// Combined for login screen
export const ALL_USERS = [...STUDENTS, ...PROFESSORS];

export const STAGES = [
  { id: "prototyping", name: "Prototyping", emoji: "🔧" },
  { id: "testing", name: "Testing", emoji: "🧪" },
  { id: "lab_work", name: "Lab Work", emoji: "🔬" },
  { id: "experiment", name: "Experiment", emoji: "⚗️" },
];

export const CAPTURE_TYPES = [
  { id: "observation", name: "Observation", emoji: "👁️" },
  { id: "problem", name: "Problem", emoji: "⚠️" },
  { id: "result", name: "Result", emoji: "✅" },
  { id: "idea", name: "Idea", emoji: "💡" },
];
