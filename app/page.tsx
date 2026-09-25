import Link from "next/link";
import { supabase } from "../lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
    const { data: jokes, error } = await supabase
        .from("jokes")
        .select("id, setup, punchline")
        .order("id", { ascending: true });

    if (error) {
        return (
            <main
                style={{
                    maxWidth: "800px",
                    margin: "0 auto",
                    padding: "40px",
                    fontFamily: "Arial",
                }}
            >
                <h1>Jokes</h1>
                <p>Error loading jokes: {error.message}</p>
            </main>
        );
    }

    return (
        <main
            style={{
                maxWidth: "800px",
                margin: "0 auto",
                padding: "40px",
                fontFamily: "Arial",
            }}
        >
            <h1>Jokes from Supabase</h1>

            <Link
                href="/login"
                style={{
                    display: "inline-block",
                    marginTop: "10px",
                    marginBottom: "30px",
                    padding: "10px 18px",
                    backgroundColor: "#111",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "6px",
                    fontSize: "16px",
                    cursor: "pointer",
                }}
            >
                Sign in / View Profile
            </Link>

            <ul
                style={{
                    paddingLeft: "20px",
                }}
            >
                {jokes.map((joke) => (
                    <li
                        key={joke.id}
                        style={{
                            marginBottom: "24px",
                        }}
                    >
                        <strong>{joke.setup}</strong>
                        <p>{joke.punchline}</p>
                    </li>
                ))}
            </ul>
        </main>
    );
}
