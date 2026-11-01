import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#14110F] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#F3ECE0] border border-[#E4D9C5] rounded-md p-6 text-center space-y-4">
        <div className="font-mono text-xs uppercase tracking-widest text-[#8B6B2E]">
          404 · Not Found
        </div>
        <h1 className="font-serif text-2xl font-semibold">
          Event Plan Not Found
        </h1>
        <p className="text-sm text-[#5C5349]">
          The requested event plan or share link does not exist or has expired.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 rounded bg-[#14110F] text-[#FBF7F0] text-xs font-medium hover:bg-[#2A2420] transition-colors"
        >
          Return to Aayojan Workspace
        </Link>
      </div>
    </div>
  );
}
