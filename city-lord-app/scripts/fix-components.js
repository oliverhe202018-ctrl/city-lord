import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('d:/project/city-lord-app/src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/next\/navigation/g, 'react-router-dom');
    content = content.replace(/useRouter/g, 'useNavigate');
    content = content.replace(/const router = useNavigate\(\)/g, 'const navigate = useNavigate()');
    content = content.replace(/router\.push/g, 'navigate');
    content = content.replace(/router\.replace\((.*?)\)/g, 'navigate($1, { replace: true })');
    content = content.replace(/router\.back\(\)/g, 'navigate(-1)');
    content = content.replace(/next\/link/g, 'react-router-dom');
    content = content.replace(/<Link href=/g, '<Link to=');
    content = content.replace(/next\/image/g, 'react');
    content = content.replace(/<Image/g, '<img');
    content = content.replace(/import \{ fetchWithTimeout \} from '@\/lib\/utils'/g, "import { fetchWithTimeout, customFetch as fetch } from '@/lib/fetch-shim'");

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Processed', filePath);
    }
  }
});

// Fix GamePageContent explicitly
const gamePagePath = 'd:/project/city-lord-app/src/components/game/game-page-content.tsx';
let gameContent = fs.readFileSync(gamePagePath, 'utf8');
gameContent = gameContent.replace(/export function GamePageContent\(\{([\s\S]*?)\}: GamePageContentProps\) \{/g, 'export function GamePageContent({$1, children}: GamePageContentProps & { children?: React.ReactNode }) {');
gameContent = gameContent.replace(/const \[activeTab, setActiveTab\] = useState<TabType>\(\(\) => \{[\s\S]*?return 'home';\n  \}\)/g, 'const location = (window as any).ReactRouterDOM?.useLocation?.() || { pathname: "/home" }; const routeMap: Record<string, TabType> = { map: "play", start: "start", home: "home", social: "social", profile: "profile" }; const activeTab = routeMap[location.pathname.replace("/", "")] || "home"; const setActiveTab = (t: string) => {};');
gameContent = gameContent.replace(/\{!isRunTakeoverActive && activeTab === "home" && \([\s\S]*?\}\)/g, '');
gameContent = gameContent.replace(/\{!isRunTakeoverActive && activeTab === "mode" && \([\s\S]*?\}\)/g, '');
gameContent = gameContent.replace(/\{!isRunTakeoverActive && activeTab === "missions" && \([\s\S]*?\}\)/g, '');
gameContent = gameContent.replace(/\{!isRunTakeoverActive && activeTab === "leaderboard" && \([\s\S]*?\}\)/g, '');
gameContent = gameContent.replace(/\{!isRunTakeoverActive && activeTab === "social" && \([\s\S]*?\}\)/g, '');
gameContent = gameContent.replace(/\{!isRunTakeoverActive && activeTab === "profile" && \([\s\S]*?\}\)/g, '{!isRunTakeoverActive && activeTab !== "play" && activeTab !== "start" && ( <div className="absolute inset-0 z-40 bg-[#0f172a]">{children}</div> )}');
gameContent = gameContent.replace(/import \{ GameHomePage as HomePageContent \}.*/g, '');
gameContent = gameContent.replace(/import SocialPageContent.*/g, '');
gameContent = gameContent.replace(/import \{ ProfilePage as MemoizedProfile \}.*/g, '');
gameContent = gameContent.replace(/import \{ LeaderboardPage as MemoizedLeaderboard \}.*/g, '');
gameContent = gameContent.replace(/import \{ ModeSelectPage as MemoizedModeSelect \}.*/g, '');
fs.writeFileSync(gamePagePath, gameContent, 'utf8');
