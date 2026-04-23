import MatchAnalysisPage, { generateMetadata as generateAnalysisMetadata } from "../analysis/page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const generateMetadata = generateAnalysisMetadata;

export default MatchAnalysisPage;
