import Link from "next/link";

export const metadata = {
  title: "Controlla la tua email - OpenReply",
  description: "Ti abbiamo inviato per email un link di accesso.",
};

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            OpenReply
          </h1>
        </div>

        <div className="panel rounded p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Controlla la tua email</h2>
          <p className="text-sm text-muted">
            Ti abbiamo inviato un link di accesso sicuro. Aprilo su questo dispositivo per continuare.
          </p>
          <p className="mt-6 text-sm">
            <Link href="/login" className="text-accent hover:underline">
              Torna all&apos;accesso
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
