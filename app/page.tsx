import DeleteCaptionButton from "@/app/components/delete-caption-button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import VoteButtons from "@/app/components/vote-buttons";

type CaptionGeneration = {
    id: string;
    image_path: string;
    prompt: string;
    caption: string;
    model: string;
    created_at: string;
    score: number;
    vote_count: number;
    creator_username: string | null;
};

type Props = {
    searchParams: Promise<{
        sort?: string;
    }>;
};

export const dynamic = "force-dynamic";

export default async function Home({
                                       searchParams,
                                   }: Props) {
    const params = await searchParams;

    const sort =
        params.sort === "top"
            ? "top"
            : "new";

    const supabase = await createClient();

    const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: recentVibes } = await supabase
        .from("caption_generations")
        .select("vibe")
        .gte("created_at", sevenDaysAgo)
        .not("vibe", "is", null);

    const vibeCounts: Record<string, number> = {};

    for (const row of recentVibes ?? []) {
        if (row.vibe) {
            vibeCounts[row.vibe] =
                (vibeCounts[row.vibe] ?? 0) + 1;
        }
    }

    const popularVibe =
        Object.entries(vibeCounts).sort(
            (a, b) => b[1] - a[1]
        )[0]?.[0] ?? "Things that only happen in NYC";

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: feedData, error } =
        await supabase.rpc("get_caption_feed");

    if (error) {
        return (
            <main className="feed-page">
                <div className="feed-container">
                    <h1>Morningside Caption Club</h1>

                    <p>
                        Error loading captions: {error.message}
                    </p>
                </div>
            </main>
        );
    }

    let generations =
        (feedData ?? []) as CaptionGeneration[];

    if (sort === "top") {
        generations = [...generations].sort(
            (a, b) =>
                Number(b.score) - Number(a.score)
        );
    } else {
        generations = [...generations].sort(
            (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
        );
    }

    let userVotes: Record<string, number> = {};
    let ownGenerationIds = new Set<string>();


    if (user) {
        const { data: votes } = await supabase
            .from("votes")
            .select("generation_id, value")
            .eq("user_id", user.id);

        userVotes = Object.fromEntries(
            (votes ?? []).map((vote) => [
                vote.generation_id,
                vote.value,
            ])
        );
        const { data: ownGenerations } =
            await supabase
                .from("caption_generations")
                .select("id")
                .eq("user_id", user.id);

        ownGenerationIds = new Set(
            (ownGenerations ?? []).map(
                (generation) => generation.id
            )
        );
    }

    return (
        <main className="feed-page">
            <div className="feed-container">
                <header className="feed-header">
                    <p className="eyebrow">
                        Columbia × NYC
                    </p>

                    <h1 className="feed-title">
                        Morningside Caption Club
                    </h1>

                    <p className="feed-subtitle">
                        AI captions for campus chaos and NYC
                        moments.
                    </p>

                    <div className="today-vibe">
                        <strong>Today&apos;s vibe:</strong>{" "}
                        {popularVibe}
                    </div>

                    <div className="nav-row">
                        {user ? (
                            <>
                                <Link
                                    href="/create"
                                    className="primary-button"
                                >
                                    + Create Caption
                                </Link>

                                <Link
                                    href="/profile"
                                    className="secondary-button"
                                >
                                    Profile
                                </Link>
                            </>
                        ) : (
                            <Link
                                href="/login"
                                className="primary-button"
                            >
                                Sign in
                            </Link>
                        )}
                    </div>
                </header>

                <nav className="feed-tabs">
                    <Link
                        href="/?sort=new"
                        className={
                            sort === "new"
                                ? "feed-tab feed-tab-active"
                                : "feed-tab"
                        }
                    >
                        New
                    </Link>

                    <Link
                        href="/?sort=top"
                        className={
                            sort === "top"
                                ? "feed-tab feed-tab-active"
                                : "feed-tab"
                        }
                    >
                        Top
                    </Link>
                </nav>

                {generations.length === 0 ? (
                    <section className="empty-state">
                        <h2>No captions yet</h2>

                        <p>
                            Be the first person to turn a campus
                            or NYC moment into an AI caption.
                        </p>

                        {user && (
                            <Link
                                href="/create"
                                className="primary-button"
                            >
                                Create the first caption
                            </Link>
                        )}
                    </section>
                ) : (
                    <div className="caption-feed">
                        {generations.map((generation) => {
                            const {
                                data: { publicUrl },
                            } = supabase.storage
                                .from("caption-images")
                                .getPublicUrl(
                                    generation.image_path
                                );

                            return (
                                <article
                                    key={generation.id}
                                    className="caption-card"
                                >
                                    <img
                                        src={publicUrl}
                                        alt="Caption submission"
                                        className="caption-image"
                                    />

                                    <div className="caption-content">
                                        {user && (
                                            <p className="caption-author">
                                                {generation.creator_username
                                                    ? `@${generation.creator_username}`
                                                    : "Anonymous"}
                                            </p>
                                        )}

                                        <p className="caption-text">
                                            “{generation.caption}”
                                        </p>

                                        <p className="caption-meta">
                                            AI generated •{" "}
                                            {generation.model}
                                        </p>

                                        <VoteButtons
                                            generationId={generation.id}
                                            isLoggedIn={Boolean(user)}
                                            existingVote={
                                                userVotes[generation.id] ?? null
                                            }
                                            score={Number(generation.score)}
                                        />

                                        {ownGenerationIds.has(generation.id) && (
                                            <DeleteCaptionButton
                                                generationId={generation.id}
                                                imagePath={generation.image_path}
                                            />
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
