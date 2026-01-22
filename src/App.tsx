import { useState, useEffect } from 'react';

// --- DATA TYPES ---

type MaritalStatus = 'Single' | 'Married' | 'Common-Law';
type LangFluency = 'Extremely' | 'Mostly' | 'Somewhat' | 'Not';
type EaseOfLiving = 'Very Easily' | 'Easily' | 'Somewhat Easily' | 'Not Easily';

// --- SCRIPT TYPES ---

interface ScriptOption {
  label: string;
  val: any;
  next?: number; // Optional: jumps to specific index
  jump?: number; // Optional: alias for next, used for specific logic skips
}

interface ScriptStep {
  text: string;
  type: 'statement' | 'choice' | 'input';
  next?: number; 
  field?: keyof UserProfile; 
  options?: ScriptOption[]; 
  setter?: (val: any) => void; 
  dummy?: boolean; 
}

interface UserProfile {
  maritalStatus: MaritalStatus;
  spouseAccompanying: boolean;
  spouseCanadian: boolean;
  age: number;
  education: string; // Key for logic
  canadianEducation: 'None' | '1or2Year' | '3YearOrMore';
  english: { speak: number; listen: number; read: number; write: number }; 
  french: { speak: number; listen: number; read: number; write: number };
  firstLanguage: 'English' | 'French' | 'Neither';
  workInCanada: number;
  workForeign: number;
  certificateOfQualification: boolean;
  pnp: boolean;
  siblingInCanada: boolean;
  category: string;
  
  // Spouse
  spouseEducation: string;
  spouseWorkInCanada: number;
  spouseEnglish: { speak: number; listen: number; read: number; write: number };
}

interface ScoreBreakdown {
    total: number;
    coreHumanCapital: number; // Max 500 (or 460 with spouse)
    spouseFactors: number;    // Max 40
    transferability: number;  // Max 100
    additional: number;       // Max 600
    
    // Detailed component breakdown for display/debugging
    age: number;
    education: number;
    language: number;
    cdnWork: number;
    frenchBonus: number;
    cdnEducation: number;
    pnp: number;
    sibling: number;
}

const initialProfile: UserProfile = {
  maritalStatus: 'Single',
  spouseAccompanying: false,
  spouseCanadian: false,
  age: 25,
  education: 'ThreeYear',
  canadianEducation: 'None',
  english: { speak: 0, listen: 0, read: 0, write: 0 },
  french: { speak: 0, listen: 0, read: 0, write: 0 },
  firstLanguage: 'Neither',
  workInCanada: 0,
  workForeign: 0,
  certificateOfQualification: false,
  pnp: false,
  siblingInCanada: false,
  category: 'General',
  
  spouseEducation: 'None',
  spouseWorkInCanada: 0,
  spouseEnglish: { speak: 0, listen: 0, read: 0, write: 0 },
};

type Scene = 'intro' | 'interview' | 'thinking' | 'result';
const initialScene: Scene = 'intro';
const initialScriptIndex = 0;

// --- MAPPINGS & HELPERS ---

const mapFluencyToCLB = (f: LangFluency): number => {
    switch(f) {
        case 'Extremely': return 9;
        case 'Mostly': return 8;
        case 'Somewhat': return 6;
        case 'Not': return 4;
        default: return 0;
    }
};

const mapEaseToCLB = (e: EaseOfLiving): number => {
    switch(e) {
        case 'Very Easily': return 9;
        case 'Easily': return 7; // CLB 7 is standard "good"
        case 'Somewhat Easily': return 5;
        case 'Not Easily': return 0;
        default: return 0;
    }
};

const EDUCATION_MAP: Record<string, string> = {
  None: 'Less than secondary school',
  Secondary: 'Secondary diploma',
  OneYear: 'One-year degree/diploma',
  TwoYear: 'Two-year degree/diploma',
  ThreeYear: 'Bachelor\'s OR 3+ year program',
  TwoOrMore: 'Two or more certificates (one 3+ years)',
  Masters: 'Master\'s degree',
  PhD: 'Doctoral level (Ph.D.)'
};

// --- DRAW HISTORY DATA ---
const DRAW_HISTORY = [
  { stream: 'General / All Programs', score: 529, date: 'Apr 23, 2024', cat: 'General' },
  { stream: 'General / All Programs', score: 535, date: 'Apr 02, 2024', cat: 'General' },
  { stream: 'General / All Programs', score: 542, date: 'Feb 26, 2024', cat: 'General' },
  { stream: 'CEC (Canadian Experience)', score: 533, date: 'Nov 12, 2025', cat: 'CEC' },
  { stream: 'CEC (Canadian Experience)', score: 541, date: 'Sep 05, 2025', cat: 'CEC' },
  { stream: 'CEC (Canadian Experience)', score: 550, date: 'Jul 21, 2025', cat: 'CEC' },
  { stream: 'PNP (Provincial Nominee)', score: 738, date: 'Nov 10, 2025', cat: 'PNP' },
  { stream: 'PNP (Provincial Nominee)', score: 752, date: 'Aug 19, 2025', cat: 'PNP' },
  { stream: 'French Proficiency', score: 416, date: 'Oct 29, 2025', cat: 'French' },
  { stream: 'Healthcare', score: 462, date: 'Nov 14, 2025', cat: 'Healthcare' },
  { stream: 'Trades', score: 505, date: 'Sep 18, 2025', cat: 'Trades' },
  { stream: 'STEM', score: 491, date: 'Apr 11, 2024', cat: 'STEM' },
  { stream: 'Transport', score: 430, date: 'Mar 13, 2024', cat: 'Transport' },
];

// --- LOGIC ENGINE ---

const calculateScore = (p: UserProfile): ScoreBreakdown => {
    // Define CLB scores for easy access (assuming English is L1 and French is L2 for simplicity)
    const L1 = p.english; // English CLB Scores
    const L2 = p.french;  // French NCLC Scores
    
    const withSpouse = (p.maritalStatus !== 'Single') && p.spouseAccompanying && !p.spouseCanadian;

    // --- A. Core Human Capital (CHC) Scores ---
    let agePoints = 0;
    let educationPoints = 0;
    let languagePoints = 0; // Total of all 4 L1 skills
    let cdnWorkPoints = 0;
    let spousePoints = 0;
    let transferabilityPoints = 0;
    let additionalPoints = 0;
    
    // A. AGE 
    const ageMapSingle: any = { 18:99, 19:105, 20:110, 29:110, 30:105, 31:99, 32:94, 33:88, 34:83, 35:77, 40:50, 44:6, 45:0 };
    const ageMapSpouse: any = { 18:90, 19:95, 20:100, 29:100, 30:95, 31:90, 32:85, 33:80, 34:75, 35:70, 40:45, 44:5, 45:0 };
    if(p.age >= 20 && p.age <= 29) agePoints = withSpouse ? 100 : 110;
    else if(ageMapSingle[p.age]) agePoints = withSpouse ? ageMapSpouse[p.age] : ageMapSingle[p.age];
    else if(p.age > 29 && p.age < 40) {
        const diff = p.age - 29;
        agePoints = withSpouse ? (100 - (diff * 5)) : (110 - (diff * 6));
    }
    agePoints = Math.max(0, agePoints);

    // B. EDUCATION 
    const eduScore = { 'None':0, 'Secondary':30, 'OneYear':90, 'TwoYear':98, 'ThreeYear':120, 'TwoOrMore':128, 'Masters':135, 'PhD':150 };
    const eduScoreSpouse = { 'None':0, 'Secondary':28, 'OneYear':84, 'TwoYear':91, 'ThreeYear':112, 'TwoOrMore':119, 'Masters':126, 'PhD':140 };
    educationPoints = withSpouse ? (eduScoreSpouse[p.education as keyof typeof eduScoreSpouse] || 0) : (eduScore[p.education as keyof typeof eduScore] || 0);

    // C. LANGUAGE (L1 Points)
    const langPoints = (clb: number) => {
        if(withSpouse) {
            if(clb >= 10) return 32; if(clb===9) return 29; if(clb===8) return 22; if(clb===7) return 16; return 0;
        } else {
            if(clb >= 10) return 34; if(clb===9) return 31; if(clb===8) return 23; if(clb===7) return 17; return 0;
        }
    };
    languagePoints = langPoints(L1.speak) + langPoints(L1.listen) + langPoints(L1.read) + langPoints(L1.write);
    
    // D. WORK (Cdn Work)
    const workMap = { 0:0, 1:40, 2:53, 3:64, 4:72, 5:80 };
    const workMapSpouse = { 0:0, 1:35, 2:46, 3:56, 4:63, 5:70 };
    const yrs = Math.min(p.workInCanada, 5) as keyof typeof workMap;
    cdnWorkPoints = withSpouse ? workMapSpouse[yrs] : workMap[yrs];

    // --- B. SPOUSE/PARTNER FACTORS (Simplifying Spouse points to a fixed amount for this mock) 
    if(withSpouse) spousePoints = 20; // Max 40, simplified placeholder

    // --- C. TRANSFERABILITY (Simplifying for mock) ---
    // If CLB 9 and 2+ degrees: 50. If CLB 9 and Foreign Work: 50. Max 100.
    const clb9 = L1.speak >= 9 && L1.listen >= 9 && L1.read >= 9 && L1.write >= 9;
    const twoDeg = p.education === 'TwoOrMore' || p.education === 'Masters' || p.education === 'PhD';
    
    if(clb9 && twoDeg) transferabilityPoints += 50;
    else if(clb9 && p.education !== 'None') transferabilityPoints += 25;

    if(clb9 && p.workForeign >= 3) transferabilityPoints += 50;
    else if(clb9 && p.workForeign >= 1) transferabilityPoints += 25;
    transferabilityPoints = Math.min(transferabilityPoints, 100);

    // --- D. ADDITIONAL POINTS (MAX 600) ---
    
    let pnpPoints = 0;
    let siblingPoints = 0;
    let cdnEducationPoints = 0;
    let frenchBonusPoints = 0;
    
    // Provincial or territorial nomination: 600 points
    if(p.pnp) pnpPoints = 600;

    // Brother or sister living in Canada: 15 points
    if(p.siblingInCanada) siblingPoints = 15;
    
    // Post-secondary education in Canada: 15 / 30 points
    if(p.canadianEducation === '3YearOrMore') cdnEducationPoints = 30;
    if(p.canadianEducation === '1or2Year') cdnEducationPoints = 15;
    
    // French Language Bonus Points (NCLC 7+)
    const frenchNCLC7 = L2.speak >= 7 && L2.listen >= 7 && L2.read >= 7 && L2.write >= 7;
    const englishCLB5 = L1.speak >= 5 && L1.listen >= 5 && L1.read >= 5 && L1.write >= 5;
    const englishCLB4OrLower = L1.speak <= 4 && L1.listen <= 4 && L1.read <= 4 && L1.write <= 4;
    
    if (frenchNCLC7) {
        if (englishCLB5) {
            frenchBonusPoints = 50; // NCLC 7+ and CLB 5+ English: 50
        } else if (englishCLB4OrLower) {
            frenchBonusPoints = 25; // NCLC 7+ and CLB 4- English: 25
        }
    }

    // Sum additional points, apply max 600
    additionalPoints = pnpPoints + siblingPoints + cdnEducationPoints + frenchBonusPoints;
    additionalPoints = Math.min(additionalPoints, 600);

    // --- FINAL TOTALS ---
    const coreHumanCapital = agePoints + educationPoints + languagePoints + cdnWorkPoints;

    const totalScore = coreHumanCapital + spousePoints + transferabilityPoints + additionalPoints;

    return {
        total: Math.min(totalScore, 1200),
        coreHumanCapital: coreHumanCapital,
        spouseFactors: spousePoints,
        transferability: transferabilityPoints,
        additional: additionalPoints,
        
        // Breakdown for Officer Notes/Debug
        age: agePoints,
        education: educationPoints,
        language: languagePoints,
        cdnWork: cdnWorkPoints,
        frenchBonus: frenchBonusPoints,
        cdnEducation: cdnEducationPoints,
        pnp: pnpPoints,
        sibling: siblingPoints,
    };
}


// --- COMPONENTS ---

// 1. OFFICER GAGNON AVATAR
const OfficerGagnon = ({ talking }: { talking: boolean }) => (
  <div className="relative w-48 h-[202px] md:w-64 md:h-[266px] flex-shrink-0 mx-auto border-b-4 border-gray-800">
    <svg viewBox="0 0 200 210" className="w-full h-full drop-shadow-xl">
      {/* Neck */}
      <rect x="85" y="140" width="30" height="30" fill="#f6ad55" />
      
      {/* Head */}
      <path d="M60,70 L140,70 L140,150 Q100,170 60,150 Z" fill="#f6ad55" />
      
      {/* Hat */}
      <path d="M50,70 L150,70 L140,40 L60,40 Z" fill="#1a202c" />
      <rect x="95" y="45" width="10" height="10" fill="#fbbf24" /> 
      <rect x="50" y="70" width="100" height="10" fill="#2d3748" /> 

      {/* Face Features */}
      <circle cx="80" cy="100" r="5" fill="#1a202c" />
      <circle cx="120" cy="100" r="5" fill="#1a202c" />
      <path d="M95,110 L90,125 L105,125 Z" fill="#e2e8f0" opacity="0.5" /> 

      {/* Chest/Body */}
      <path d="M30,160 L170,160 L180,210 L20,210 Z" fill="#1a202c" />
      
      {/* Tie/Shirt Detail */}
      <rect x="95" y="160" width="10" height="50" fill="#cbd5e0" />
      <path d="M100,160 L100,210" stroke="#718096" strokeWidth="1" />
      
      {/* Shoulders */}
      <path d="M40,160 Q30,150 20,170 L20,210 L60,210 Z" fill="#2d3748" />
      <path d="M160,160 Q170,150 180,170 L180,210 L140,210 Z" fill="#2d3748" />
      
      {/* NEW: Desk/Table (Covers the gap at the very bottom) */}
      <rect x="0" y="195" width="200" height="15" fill="#2d3748" />
      <rect x="0" y="195" width="200" height="2" fill="#4a5568" /> {/* Table Edge highlight */}

      {/* Mouth */}
      {talking ? (
        <ellipse cx="100" cy="140" rx="10" ry="8" fill="#742a2a">
          <animate attributeName="ry" values="2;8;2" dur="0.2s" repeatCount="indefinite" />
        </ellipse>
      ) : (
        <path d="M90,140 Q100,145 110,140" stroke="#742a2a" strokeWidth="3" fill="none" />
      )}
      
      {/* Badge Name (Raised slightly to sit above the table) */}
      <text x="125" y="182" fontSize="10" fill="white" fontFamily="monospace" fontWeight="bold">GAGNON</text>
    </svg>
  </div>
);

// 2. TYPEWRITER TEXT
const Typewriter = ({ text, onComplete }: { text: string, onComplete: () => void }) => {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.substring(0, i + 1));
      i++;
      if (i === text.length) {
        clearInterval(timer);
        onComplete();
      }
    }, 30); // Speed
    return () => clearInterval(timer);
  }, [text]);

  return <p className="text-lg md:text-xl font-mono leading-relaxed">{displayed}</p>;
};

const ScoreRow = ({ label, points, max }: { label: string; points: number; max?: number }) => (
    <div className="flex justify-between py-1 px-2 border-b last:border-b-0">
        <span className="text-gray-700">{label}</span>
        <span className="font-bold text-gray-900">
            {points} 
            {max !== undefined && <span className="text-gray-500 text-xs"> / {max}</span>}
        </span>
    </div>
);

// --- SCENE MANAGER ---

export default function App() {
  const [scene, setScene] = useState<Scene>('intro'); // Using the defined Scene type
  const [scriptIndex, setScriptIndex] = useState(initialScriptIndex); 
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [isTalking, setIsTalking] = useState(false);
  const [canInput, setCanInput] = useState(false);
  // Stamp can be 'PASS', 'FAIL', or null (cleared/not set)
  const [stamp, setStamp] = useState<'PASS' | 'FAIL' | null>(null); 
  

  // This ensures the talking state is reset and triggered whenever the step changes.
  useEffect(() => {
    if (scene === 'interview') {
      setIsTalking(true);
    }

    // Dependency is scriptIndex, so it runs every time we move to the next step.
  }, [scriptIndex, scene]);

  // --- SCRIPT DEFINITION ---
  const SCRIPT: ScriptStep[] = [
    // 0: Intro
    {
        text: "Hello, I am Officer Gagnon. You're interested in becoming a PR in Canada? Let me ask you some questions, and we'll see if you stand a chance.",
        type: 'statement',
        next: 1
    },
    {
        text: "Are you a skilled tradesperson, a manager, or are you in the general pool of workers?",
        type: 'choice',
        options: [
            { label: "Skilled Trades", val: 'Trades' },
            { label: "Manager / Professional", val: 'General' },
            { label: "General Worker", val: 'General' },
            { label: "Healthcare Worker", val: 'Healthcare' },
        ],
        field: 'category',
        next: 2
    },
    {
        text: "Are you married or single?",
        type: 'choice',
        options: [
            { label: "Single", val: 'Single', jump: 10 }, // Jump to First Language
            { label: "Married", val: 'Married', next: 3 },
            { label: "Common-Law", val: 'Common-Law', next: 3 }
        ],
        field: 'maritalStatus'
    },
    {
        text: "Is your partner Canadian?",
        type: 'choice',
        options: [
            { label: "Yes", val: true, jump: 10 }, // Treat as single for points
            { label: "No", val: false, next: 4 }
        ],
        field: 'spouseCanadian'
    },
    {
        text: "How many years of work experience do they have IN Canada?",
        type: 'input',
        field: 'spouseWorkInCanada',
        next: 5
    },
    {
        text: "Do they speak English or French as their first language?",
        type: 'choice',
        options: [
            { label: "English", val: 'English', next: 6 },
            { label: "French", val: 'French', next: 6 }
        ],
        // Just dummy state update, mapped to logic later
        next: 6
    },
    {
        text: "How fluent are they in their first language?",
        type: 'choice',
        options: [
            { label: "Extremely", val: 'Extremely', next: 7 }, // CLB 9
            { label: "Mostly", val: 'Mostly', next: 7 }, // CLB 8
            { label: "Somewhat", val: 'Somewhat', next: 7 }, // CLB 6
            { label: "Not Very", val: 'Not', next: 7 } // CLB 4
        ],
        setter: (val: any) => {
            const clb = mapFluencyToCLB(val);
            setProfile(prev => ({...prev, spouseEnglish: { speak: clb, listen: clb, read: clb, write: clb }}));
        }
    },
    {
        text: "Do they speak the other official language (English/French) as a second language?",
        type: 'choice',
        options: [
            { label: "Yes", val: true, next: 8 },
            { label: "No", val: false, jump: 9 }
        ]
    },
    {
        text: "How easily would they be able to live by themselves in a country only using their second language?",
        type: 'choice',
        options: [
            { label: "Very Easily", val: 'Very Easily', next: 9 },
            { label: "Easily", val: 'Easily', next: 9 },
            { label: "Somewhat Easily", val: 'Somewhat Easily', next: 9 },
            { label: "Not Easily", val: 'Not Easily', next: 9 },
        ],
        next: 9
    },
    {
        text: "I see. Let's move on to you.",
        type: 'statement',
        setter: () => setProfile(prev => ({...prev, spouseAccompanying: true })),
        next: 10
    },
    {
        text: "What is your first language?",
        type: 'choice',
        options: [
            { label: "English", val: 'English', next: 11 },
            { label: "French", val: 'French', next: 11 },
            { label: "Neither", val: 'Neither', next: 11 }
        ],
        field: 'firstLanguage'
    },
    {
        text: "How confident are you in your first official language (English or French)?",
        type: 'choice',
        options: [
            { label: "Extremely", val: 'Extremely', next: 12 },
            { label: "Mostly", val: 'Mostly', next: 12 },
            { label: "Somewhat", val: 'Somewhat', next: 12 }
        ],
        setter: (val: any) => {
            const clb = mapFluencyToCLB(val);
            // Assign to English/French based on 'firstLanguage' or default to English for calc
            setProfile(prev => ({...prev, english: { speak: clb, listen: clb, read: clb, write: clb }}));
        }
    },
    {
        text: "Is your second language (if you have one), English or French?",
        type: 'choice',
        options: [
            { label: "Yes", val: true, next: 13 },
            { label: "No", val: false, jump: 15 } // Skip to comment
        ]
    },
    {
        text: "How easily would you be able to live by yourself in a country only using your second language?",
        type: 'choice',
        options: [
            { label: "Very Easily", val: 'Very Easily', next: 14 },
            { label: "Easily", val: 'Easily', next: 14 },
            { label: "Somewhat Easily", val: 'Somewhat Easily', next: 14 },
            { label: "Not Easily", val: 'Not Easily', next: 14 },
        ],
        setter: (val: any) => {
            const clb = mapEaseToCLB(val);
            setProfile(prev => ({...prev, french: { speak: clb, listen: clb, read: clb, write: clb }}));
        }
    },
    {
        text: "You know, simply saying you speak it isn't enough. You must take a licensed language exam and pay out of your own pocket to prove it.",
        type: 'statement',
        next: 15
    },
    {
        text: "Now, how old are you?",
        type: 'input',
        field: 'age',
        next: 16
    },
    {
        text: "What is your highest level of education?",
        type: 'choice',
        options: Object.entries(EDUCATION_MAP).map(([k,v]) => ({ label: v, val: k })),
        field: 'education',
        next: 17
    },
    {
        text: "And what specific institution did you study at?",
        type: 'input',
        dummy: true, 
        next: 18 
    },
    {
        text: "Did you complete any post-secondary education in Canada?",
        type: 'choice',
        options: [
            { label: "Yes, credential of 3 years or longer", val: '3YearOrMore' },
            { label: "Yes, credential of 1 or 2 years", val: '1or2Year' },
            { label: "No", val: 'None' }
        ],
        field: 'canadianEducation',
        next: 19 
    },
    {
        text: "Hmph. It doesn't matter where you went to school in Canada. The only thing that matters is the length and field. Your application gets the same points if you're from UofT or from a diploma mill college.",
        type: 'statement',
        next: 20 
    },
    {
        text: "How many years of skilled work experience do you have INSIDE Canada?",
        type: 'input',
        field: 'workInCanada',
        next: 21 
    },
    {
        text: "How many years of skilled work experience do you have OUTSIDE Canada?",
        type: 'input',
        field: 'workForeign',
        next: 22 
    },
    {
        text: "Just so you know, almost all applicants can't even get more than three years of experience counted. And full-time work during studies, like co-op? Doesn't count at all for the general economic stream.",
        type: 'statement',
        next: 23 
    },
    {
        text: "Almost done. Do you have a sibling who is a citizen or PR living in Canada?",
        type: 'choice',
        options: [ {label:"Yes", val:true}, {label:"No", val:false} ],
        field: 'siblingInCanada',
        next: 24 
    },
    {
        text: "Do you have a Provincial Nomination Certificate? (This is worth 600 points!)",
        type: 'choice',
        options: [ {label:"Yes", val:true}, {label:"No", val:false} ],
        field: 'pnp',
        next: 25 
    },
    {
        text: "Do you have a Certificate of Qualification in a trade issued by a Canadian province?",
        type: 'choice',
        options: [ {label:"Yes", val:true}, {label:"No", val:false} ],
        field: 'certificateOfQualification',
        next: 999 // END
    }
  ];

  // --- ACTIONS ---

  const handleStart = () => {
    setScene('interview');
    setScriptIndex(0);
  };

  const handleNext = (val?: any) => {
    if (val === 'restart') {
        setProfile(initialProfile);       
        setScriptIndex(initialScriptIndex); 
        setScene(initialScene);          
        setStamp(null);                
        setCanInput(false);              
        return; 
    }
    
    const currentStep = SCRIPT[scriptIndex];
    
    // Save Data
    if (currentStep.field) {
        setProfile(prev => ({ ...prev, [currentStep.field!]: val }));
    }
    if (currentStep.setter) {
        currentStep.setter(val);
    }

    let nextIdx = currentStep.next;
    // Handle conditional jumps from options
    if (currentStep.options) {
        const selectedOption = currentStep.options.find((o: any) => o.val === val);
        if (selectedOption && selectedOption.jump) nextIdx = selectedOption.jump;
        if (selectedOption && selectedOption.next) nextIdx = selectedOption.next;
    }

    if (nextIdx === 999) {
        setScene('thinking');
    } else {
        setScriptIndex(nextIdx || scriptIndex + 1);
    }
    setCanInput(false);
};

  // --- RENDERERS ---

  if (scene === 'intro') {
    return (
        <div className="min-h-screen bg-[#6e2e2e] flex flex-col items-center justify-center p-6 font-sans">
            <div className="max-w-2xl bg-[#e9dace] rounded-sm shadow-2xl p-8 border-t-8 border-[#7b3f39]">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-6">Immigrate to Canada 2025</h1>
                <p className="text-gray-700 text-lg mb-4 italic">
                    "If you were born and raised in Canada, you've probably never interacted with the immigration system. You might have heard in school that Canada's immigration system is fair, and brings in people from across the world that are ready to contribute most to the country."
                </p>
                <p className="text-gray-800 text-xl font-bold mb-8">
                    "Let's pretend you're an immigrant to Canada in 2025. Would you be able to qualify for a Permanent Residency?"
                </p>
                <button 
                    onClick={handleStart}
                    className="w-full bg-[#6e2e2e] hover:bg-red-800 text-white font-bold py-4 text-xl tracking-widest uppercase transition-transform transform hover:scale-105"
                >
                    Start Interview
                </button>
            </div>
        </div>
    );
  }

  if (scene === 'thinking') {
      setTimeout(() => {
        const scoreData = calculateScore(profile);
        // Logic: Pass if score > min of ANY eligible stream history
        let passed = false;
        // Filter eligible streams
        const relevantDraws = DRAW_HISTORY.filter(d => {
            if(d.cat === 'General') return true;
            if(d.cat === profile.category) return true;
            if(d.cat === 'CEC' && profile.workInCanada >= 1) return true;
            if(d.cat === 'PNP' && profile.pnp) return true;
            if(d.cat === 'French' && profile.french.speak >= 7) return true;
            return false;
        });
        // Did we beat ANY recent draw?
        if (relevantDraws.some(d => scoreData.total >= d.score)) passed = true;
        
        setStamp(passed ? 'PASS' : 'FAIL');
        setScene('result');
      }, 3000);

      return (
        <div className="min-h-screen bg-[#6e2e2e] flex flex-col items-center justify-center">
            <OfficerGagnon talking={false} />
            <div className="mt-8 text-white text-2xl animate-pulse font-mono">
                Officer Gagnon is reviewing your file...
            </div>
        </div>
      );
  }

  if (scene === 'result') {
      // Use the updated calculateScore function to get the detailed object
      const scoreData = calculateScore(profile);
      const score = scoreData.total;
      
      const relevantDraws = DRAW_HISTORY.filter(d => {
          if(d.cat === 'General') return true;
          if(d.cat === profile.category) return true;
          if(d.cat === 'CEC' && profile.workInCanada >= 1) return true;
          if(d.cat === 'PNP' && profile.pnp) return true;
          if(d.cat === 'French' && profile.french.speak >= 7) return true;
          return false;
      });

      return (
          <div className="min-h-screen bg-[#6e2e2e] flex flex-col items-center p-4">
               {/* STAMP ANIMATION */}
              <div className="fixed bottom-20 right-[25%] pointer-events-none z-50 ${stamp ? 'animate-bounce' : ''}">
                   <div className={`border-8 text-8xl font-black p-10 transform -rotate-12 opacity-90 ${stamp==='PASS' ? 'border-green-600 text-green-600' : 'border-[#9e3737] text-red-600'}`}>
                       {stamp}
                   </div>
               </div>

               <div className="bg-white max-w-4xl w-full mt-20 p-8 rounded shadow-2xl relative z-10">
                   <div className="flex items-center justify-between border-b pb-4 mb-4">
                       <h2 className="text-3xl font-bold text-gray-800">APPLICATION RESULTS</h2>
                       <div className="text-5xl font-mono font-bold text-blue-800">{score} CRS</div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       
                       {/* LEFT COLUMN: SCORE BREAKDOWN (NEW) */}
                       <div className="bg-gray-50 p-4 rounded text-sm border">
                           <h3 className="text-lg font-bold border-b border-gray-300 pb-2 mb-2">CRS Score Breakdown:</h3>
                           
                           {/* Core Human Capital (A) */}
                           <div className="bg-gray-200 font-bold p-1 mt-3">A. Core Human Capital ({scoreData.coreHumanCapital})</div>
                           <ScoreRow label="Age" points={scoreData.age} />
                           <ScoreRow label="Education" points={scoreData.education} />
                           <ScoreRow label="Language Skills" points={scoreData.language} />
                           <ScoreRow label="Cdn Work Experience" points={scoreData.cdnWork} />
                           
                           {/* Spouse Factors (B) */}
                           <div className="bg-gray-200 font-bold p-1 mt-3">B. Spouse/Partner Factors ({scoreData.spouseFactors})</div>
                           <ScoreRow label="Spouse/Partner" points={scoreData.spouseFactors} max={40}/>
                           
                           {/* Transferability (C) */}
                           <div className="bg-gray-200 font-bold p-1 mt-3">C. Transferability ({scoreData.transferability})</div>
                           <ScoreRow label="Transferability" points={scoreData.transferability} max={100}/>
                           
                           {/* Additional Factors (D) */}
                           <div className="bg-gray-200 font-bold p-1 mt-3">D. Additional Points ({scoreData.additional})</div>
                           <ScoreRow label="PNP" points={scoreData.pnp} />
                           <ScoreRow label="Canadian Education" points={scoreData.cdnEducation} />
                           <ScoreRow label="French Language Bonus" points={scoreData.frenchBonus} />
                           <ScoreRow label="Sibling in Canada" points={scoreData.sibling} />
                           
                           <div className="bg-[#a84950] text-white font-bold p-2 mt-4 flex justify-between">
                               <span>TOTAL CRS SCORE:</span>
                               <span>{score} / 1200</span>
                           </div>
                       </div>
                       
                       {/* RIGHT COLUMN: DRAW HISTORY */}
                       <div>
                           <h3 className="font-bold text-gray-500 uppercase tracking-widest mb-4">Eligible Streams & Past Draws</h3>
                           <div className="space-y-3 h-64 overflow-y-auto">
                               {relevantDraws.map((d, i) => (
                                   <div key={i} className={`flex justify-between p-3 border-l-4 ${score >= d.score ? 'border-green-500 bg-green-50' : 'border-[#9e3737] bg-[#debed2]'}`}>
                                       <div>
                                           <span className="font-bold">{d.date}</span> - <span className="text-gray-600">{d.cat}</span>
                                       </div>
                                       <div className="font-bold">
                                           {d.score}
                                           <span className="text-xs text-gray-500"> CRS</span>
                                           {score >= d.score && <span className="ml-2 text-green-700 font-extrabold">✓ PASSED</span>}
                                       </div>
                                   </div>
                               ))}
                               {relevantDraws.length === 0 && <p className="text-red-500 italic">You are not eligible for</p> }
                           </div>
                           
                           {/* OFFICER NOTES (Placeholder for completeness) */}
                           <div className="bg-gray-100 p-4 rounded text-sm font-mono mt-4">
                               <p className="font-bold text-lg mb-2">Officer's Notes:</p>
                               <p>Current CRS: {score}</p>
                               <p>{stamp === 'PASS' ? 'Applicant meets criteria for current Express Entry rounds.' : 'Applicant does not meet recent Express Entry draw scores.'}</p>
                            </div>

                       </div>
                       
                   </div>
                   
                   {/* --- RESTART BUTTON --- */}
                   <div className="mt-8 flex justify-center">
                       <button
                           onClick={() => handleNext('restart')}
                           className="bg-[#a84950] text-white px-12 py-4 text-xl font-bold rounded hover:bg-[#9e3737] transition duration-150"
                       >
                           Restart Interview
                       </button>
                   </div>

               </div>
          </div>
      );
  }
  
  // INTERVIEW SCENE 
  const currentStep = SCRIPT[scriptIndex];
  
  return (
    <div className="min-h-screen bg-[#6e2e2e] flex flex-col justify-between font-sans relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
            <span className="text-9xl font-black text-white">CANADA</span>
        </div>

        {/* Character Area */}
        <div className="flex-grow flex items-end justify-center pb-4">
            <OfficerGagnon talking={isTalking} />
        </div>

        {/* Dialogue Box */}
        <div className="bg-[#f5ece4] border-t-8 border-[#7b3f39] p-6 md:p-10 min-h-[300px] shadow-2xl relative z-10">
            <div className="max-w-4xl mx-auto">
                <div className="mb-4 text-red-700 font-bold uppercase tracking-widest text-sm">
                    Officer Gagnon
                </div>
                
                {/* Text Output */}
                <div className="mb-8 min-h-[80px]">
                    <Typewriter 
                        text={currentStep.text} 
                        onComplete={() => { setIsTalking(false); setCanInput(true); }} 
                    />
                </div>

        {canInput && currentStep.type === 'choice' && (
          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            {currentStep.options!.map((option) => (
              <button
                key={option.label}
                onClick={() => handleNext(option.val)}
                className="bg-[#6e2e2e] text-white font-semibold py-3 px-4 rounded hover:bg-[#6e2e2e] transition"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        
        {canInput && currentStep.type === 'input' && (
            <form onSubmit={(e) => {
                e.preventDefault();
                const inputElement = e.currentTarget.elements[0] as HTMLInputElement;
                if (inputElement.value) handleNext(parseInt(inputElement.value) || inputElement.value);
            }} className="mt-8 flex space-x-2">
                <input 
                    type={currentStep.field === 'age' || currentStep.field === 'workInCanada' || currentStep.field === 'workForeign' ? 'number' : 'text'}
                    className="flex-1 p-3 border border-gray-300 rounded focus:ring-[#6e2e2e] focus:border-[#6e2e2e]"
                    required
                    placeholder="Enter your answer..."
                />
                <button type="submit" className="bg-[#6e2e2e] text-white font-semibold py-3 px-6 rounded hover:bg-[#6e2e2e] transition">
                    Submit
                </button>
            </form>
        )}
        
        {canInput && currentStep.type === 'statement' && (
            <div className="mt-8 flex justify-center">
                <button 
                    onClick={() => handleNext(null)}
                    className="bg-[#6e2e2e] text-white font-semibold py-3 px-6 rounded hover:bg-[#6e2e2e] transition"
                >
                    Continue
                </button>
            </div>
        )}

      </div>
    </div>
  );
</div>)
}

