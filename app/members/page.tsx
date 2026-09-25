import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MembersPage() {
    const supabase = await createClient();

    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
        redirect("/login");
    }

    return (
        <main
            style={{
                maxWidth: "700px",
                margin: "80px auto",
                padding: "40px",
                fontFamily: "Arial",
            }}
        >
            <h1>Members Only</h1>

            <p>
                You can only see this page because you are signed in.
            </p>

            <Link
                href="/profile"
                style={{
                    display: "inline-block",
                    marginTop: "20px",
                    padding: "10px 18px",
                    backgroundColor: "#111",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "6px",
                }}
            >
                Back to profile
            </Link>
        </main>
    );
}
