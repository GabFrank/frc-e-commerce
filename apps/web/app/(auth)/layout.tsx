import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-sm sm:max-w-md">
        <Link href="/" className="block text-center text-lg font-semibold mb-6">
          FRC E-commerce
        </Link>
        {children}
      </div>
    </div>
  );
}
